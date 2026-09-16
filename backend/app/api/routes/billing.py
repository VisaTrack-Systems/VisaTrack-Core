"""Tenant-scoped invoicing and Stripe-hosted payment endpoints."""

from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID, NAMESPACE_URL, uuid4, uuid5

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context, require_roles
from app.core.config import settings
from app.db.deps import get_db
from app.schemas.billing import (
    CheckoutSessionResponse,
    InvoiceCreateRequest,
    InvoiceResponse,
    StripeWebhookResponse,
)
from app.services.audit import log_activity
from app.services.stripe_payments import (
    StripeConfigurationError,
    StripeOperationError,
    StripeSignatureError,
    construct_webhook_event,
    create_hosted_checkout,
)

router = APIRouter(prefix="/billing", tags=["billing"])
_IDEMPOTENCY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,255}$")
_CENT = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_CENT, rounding=ROUND_HALF_UP)


def _invoice_response(row) -> InvoiceResponse:
    return InvoiceResponse(**dict(row))


@router.post(
    "/cases/{case_number}/invoices",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice(
    case_number: str,
    payload: InvoiceCreateRequest,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    if not _IDEMPOTENCY_PATTERN.fullmatch(idempotency_key):
        raise HTTPException(
            status_code=400,
            detail="Idempotency-Key must be 8-255 URL-safe characters",
        )
    case_row = db.execute(
        text(
            """
            SELECT id, client_id, primary_lawyer_id, created_by
            FROM cases
            WHERE case_number = :case_number
              AND organization_id = :organization_id
              AND deleted_at IS NULL
            FOR UPDATE
            """
        ),
        {
            "case_number": case_number,
            "organization_id": str(auth.organization_id),
        },
    ).mappings().first()
    if case_row is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if (
        auth.active_role == "lawyer"
        and auth.user_id not in {case_row["primary_lawyer_id"], case_row["created_by"]}
    ):
        raise HTTPException(status_code=403, detail="Not authorized to bill this case")

    existing_invoice = db.execute(
        text(
            """
            SELECT id, invoice_number, status, subtotal, tax_rate, tax_amount,
                   total_amount, amount_paid, amount_due, currency, issue_date, due_date
            FROM invoices
            WHERE organization_id = :organization_id
              AND idempotency_key = :idempotency_key
            """
        ),
        {
            "organization_id": str(auth.organization_id),
            "idempotency_key": idempotency_key,
        },
    ).mappings().first()
    if existing_invoice is not None:
        return _invoice_response(existing_invoice)

    if payload.due_date < date.today():
        raise HTTPException(status_code=400, detail="Invoice due date cannot be in the past")

    line_amounts = [_money(item.quantity * item.unit_price) for item in payload.items]
    subtotal = _money(sum(line_amounts, Decimal("0")))
    tax_amount = _money(subtotal * payload.tax_rate)
    total_amount = subtotal + tax_amount
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Invoice total must be greater than zero")

    invoice_id = uuid4()
    invoice_number = f"INV-{date.today().year}-{uuid4().hex[:8].upper()}"
    currency = settings.stripe_currency.upper()
    invoice_row = db.execute(
        text(
            """
            INSERT INTO invoices (
                id, organization_id, case_id, client_id, invoice_number, status,
                subtotal, tax_rate, tax_amount, total_amount, currency, issue_date,
                due_date, notes, terms, amount_paid, sent_at, created_by, idempotency_key
            ) VALUES (
                :id, :organization_id, :case_id, :client_id, :invoice_number, 'sent',
                :subtotal, :tax_rate, :tax_amount, :total_amount, :currency, CURRENT_DATE,
                :due_date, :notes, :terms, 0, NOW(), :created_by, :idempotency_key
            )
            RETURNING id, invoice_number, status, subtotal, tax_rate, tax_amount,
                      total_amount, amount_paid, amount_due, currency, issue_date, due_date
            """
        ),
        {
            "id": str(invoice_id),
            "organization_id": str(auth.organization_id),
            "case_id": str(case_row["id"]),
            "client_id": str(case_row["client_id"]),
            "invoice_number": invoice_number,
            "subtotal": subtotal,
            "tax_rate": payload.tax_rate,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "currency": currency,
            "due_date": payload.due_date,
            "notes": payload.notes,
            "terms": payload.terms,
            "created_by": str(auth.user_id),
            "idempotency_key": idempotency_key,
        },
    ).mappings().one()

    for sort_order, (item, amount) in enumerate(zip(payload.items, line_amounts, strict=True)):
        db.execute(
            text(
                """
                INSERT INTO invoice_items (
                    invoice_id, description, quantity, unit_price, amount, category, sort_order
                ) VALUES (
                    :invoice_id, :description, :quantity, :unit_price, :amount, :category, :sort_order
                )
                """
            ),
            {
                "invoice_id": str(invoice_id),
                "description": item.description.strip(),
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "amount": amount,
                "category": (item.category or "").strip() or None,
                "sort_order": sort_order,
            },
        )

    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="invoice_created",
        entity_type="invoice",
        entity_id=invoice_id,
        case_id=case_row["id"],
        client_id=case_row["client_id"],
        new_values={
            "invoice_number": invoice_number,
            "total_amount": str(total_amount),
            "currency": currency,
        },
    )
    db.commit()
    return _invoice_response(invoice_row)


@router.post(
    "/invoices/{invoice_id}/checkout-session",
    response_model=CheckoutSessionResponse,
)
def create_checkout_session(
    invoice_id: UUID,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    auth: AuthContext = Depends(require_roles("client")),
    db: Session = Depends(get_db),
) -> CheckoutSessionResponse:
    if not _IDEMPOTENCY_PATTERN.fullmatch(idempotency_key):
        raise HTTPException(
            status_code=400,
            detail="Idempotency-Key must be 8-255 URL-safe characters",
        )

    invoice = db.execute(
        text(
            """
            SELECT i.id, i.organization_id, i.client_id, i.invoice_number, i.status,
                   i.amount_due, i.currency, u.email
            FROM invoices i
            JOIN users u ON u.id = i.client_id
            WHERE i.id = :invoice_id
              AND i.organization_id = :organization_id
              AND i.client_id = :client_id
            FOR UPDATE OF i
            """
        ),
        {
            "invoice_id": str(invoice_id),
            "organization_id": str(auth.organization_id),
            "client_id": str(auth.user_id),
        },
    ).mappings().first()
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice["status"] in {"draft", "cancelled", "paid", "refunded"}:
        raise HTTPException(status_code=409, detail="Invoice is not payable")

    amount = _money(Decimal(invoice["amount_due"]))
    if amount <= 0:
        raise HTTPException(status_code=409, detail="Invoice has no outstanding balance")

    existing = db.execute(
        text(
            """
            SELECT id, checkout_url, checkout_expires_at
            FROM payments
            WHERE invoice_id = :invoice_id
              AND (
                    idempotency_key = :idempotency_key
                    OR (
                        status = 'processing'
                        AND checkout_url IS NOT NULL
                        AND checkout_expires_at > NOW()
                    )
              )
            ORDER BY (idempotency_key = :idempotency_key) DESC, created_at DESC
            LIMIT 1
            """
        ),
        {"invoice_id": str(invoice_id), "idempotency_key": idempotency_key},
    ).mappings().first()
    if existing and existing["checkout_url"] and existing["checkout_expires_at"]:
        return CheckoutSessionResponse(
            payment_id=existing["id"],
            checkout_url=existing["checkout_url"],
            expires_at=existing["checkout_expires_at"],
        )

    payment_id = uuid5(NAMESPACE_URL, f"visatrack:{invoice_id}:{idempotency_key}")
    db.execute(
        text(
            """
            INSERT INTO payments (
                id, invoice_id, amount, currency, status, provider, idempotency_key
            ) VALUES (
                :id, :invoice_id, :amount, :currency, 'pending', 'stripe', :idempotency_key
            )
            ON CONFLICT (invoice_id, idempotency_key) DO NOTHING
            """
        ),
        {
            "id": str(payment_id),
            "invoice_id": str(invoice_id),
            "amount": amount,
            "currency": str(invoice["currency"]).upper(),
            "idempotency_key": idempotency_key,
        },
    )

    stripe_key = hashlib.sha256(
        f"{invoice_id}:{idempotency_key}".encode("utf-8")
    ).hexdigest()
    try:
        checkout = create_hosted_checkout(
            amount_minor=int(amount * 100),
            currency=str(invoice["currency"]).lower(),
            invoice_number=str(invoice["invoice_number"]),
            customer_email=str(invoice["email"]),
            payment_id=str(payment_id),
            invoice_id=str(invoice_id),
            organization_id=str(auth.organization_id),
            idempotency_key=f"visatrack-checkout-{stripe_key}",
        )
    except StripeConfigurationError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except StripeOperationError as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    db.execute(
        text(
            """
            UPDATE payments
            SET provider_checkout_session_id = :session_id,
                checkout_url = :checkout_url,
                checkout_expires_at = :expires_at,
                status = 'processing',
                updated_at = NOW()
            WHERE id = :payment_id
            """
        ),
        {
            "session_id": checkout.session_id,
            "checkout_url": checkout.url,
            "expires_at": checkout.expires_at,
            "payment_id": str(payment_id),
        },
    )
    log_activity(
        db,
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        action="checkout_started",
        entity_type="payment",
        entity_id=payment_id,
        client_id=auth.user_id,
        new_values={"invoice_id": str(invoice_id), "amount": str(amount)},
    )
    db.commit()
    return CheckoutSessionResponse(
        payment_id=payment_id,
        checkout_url=checkout.url,
        expires_at=checkout.expires_at,
    )


@router.post("/stripe/webhook", response_model=StripeWebhookResponse)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
) -> StripeWebhookResponse:
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")
    payload = await request.body()
    try:
        event = construct_webhook_event(payload, stripe_signature)
    except StripeConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except StripeSignatureError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    event_id = str(event.get("id") or "")
    event_type = str(event.get("type") or "")
    if not event_id or not event_type:
        raise HTTPException(status_code=400, detail="Malformed Stripe event")

    inserted = db.execute(
        text(
            """
            INSERT INTO stripe_webhook_events (stripe_event_id, event_type, livemode)
            VALUES (:event_id, :event_type, :livemode)
            ON CONFLICT (stripe_event_id) DO NOTHING
            RETURNING id
            """
        ),
        {
            "event_id": event_id,
            "event_type": event_type,
            "livemode": bool(event.get("livemode")),
        },
    ).first()
    if inserted is None:
        db.rollback()
        return StripeWebhookResponse()

    data = event.get("data") or {}
    stripe_object = data.get("object") if hasattr(data, "get") else None
    if not hasattr(stripe_object, "get"):
        raise HTTPException(status_code=400, detail="Malformed Stripe event data")

    if event_type == "checkout.session.completed":
        _complete_checkout(db, stripe_object)
    elif event_type == "payment_intent.payment_failed":
        _fail_payment(db, stripe_object)
    elif event_type == "charge.refunded":
        _record_refund(db, stripe_object)

    db.execute(
        text(
            """
            UPDATE stripe_webhook_events
            SET processed_at = NOW()
            WHERE stripe_event_id = :event_id
            """
        ),
        {"event_id": event_id},
    )
    db.commit()
    return StripeWebhookResponse()


def _complete_checkout(db: Session, stripe_object) -> None:
    if stripe_object.get("payment_status") != "paid":
        return
    metadata = stripe_object.get("metadata") or {}
    payment_id = str(metadata.get("payment_id") or "")
    if not payment_id:
        return
    try:
        parsed_payment_id = UUID(payment_id)
    except ValueError:
        return

    payment = db.execute(
        text(
            """
            SELECT p.id, p.invoice_id, p.amount, p.currency, p.status,
                   i.organization_id, i.client_id, i.case_id
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            WHERE p.id = :payment_id AND p.provider = 'stripe'
            FOR UPDATE OF p, i
            """
        ),
        {"payment_id": payment_id},
    ).mappings().first()
    if payment is None or payment["status"] == "completed":
        return

    received_amount = Decimal(int(stripe_object.get("amount_total") or 0)) / 100
    received_currency = str(stripe_object.get("currency") or "").upper()
    if _money(received_amount) != _money(Decimal(payment["amount"])) or received_currency != str(
        payment["currency"]
    ).upper():
        db.execute(
            text(
                """
                UPDATE payments
                SET status = 'failed', failure_code = 'webhook_amount_mismatch', updated_at = NOW()
                WHERE id = :payment_id
                """
            ),
            {"payment_id": payment_id},
        )
        return

    db.execute(
        text(
            """
            UPDATE payments
            SET status = 'completed',
                provider_payment_id = :payment_intent,
                processed_at = NOW(),
                failure_code = NULL,
                updated_at = NOW()
            WHERE id = :payment_id
            """
        ),
        {
            "payment_intent": str(stripe_object.get("payment_intent") or "") or None,
            "payment_id": payment_id,
        },
    )
    db.execute(
        text(
            """
            UPDATE invoices
            SET amount_paid = LEAST(total_amount, amount_paid + :amount),
                paid_date = CASE
                    WHEN amount_paid + :amount >= total_amount THEN CURRENT_DATE
                    ELSE paid_date
                END,
                status = CASE
                    WHEN amount_paid + :amount >= total_amount THEN 'paid'
                    ELSE 'viewed'
                END,
                updated_at = NOW()
            WHERE id = :invoice_id
            """
        ),
        {"amount": payment["amount"], "invoice_id": str(payment["invoice_id"])},
    )
    log_activity(
        db,
        organization_id=payment["organization_id"],
        user_id=None,
        action="payment_completed",
        entity_type="payment",
        entity_id=parsed_payment_id,
        case_id=payment["case_id"],
        client_id=payment["client_id"],
        new_values={
            "invoice_id": str(payment["invoice_id"]),
            "amount": str(payment["amount"]),
            "currency": str(payment["currency"]),
        },
    )


def _fail_payment(db: Session, stripe_object) -> None:
    metadata = stripe_object.get("metadata") or {}
    payment_id = str(metadata.get("payment_id") or "")
    if not payment_id:
        return
    try:
        UUID(payment_id)
    except ValueError:
        return
    last_error = stripe_object.get("last_payment_error") or {}
    failure_code = str(last_error.get("code") or "payment_failed")[:100]
    db.execute(
        text(
            """
            UPDATE payments
            SET status = 'failed', failure_code = :failure_code, updated_at = NOW()
            WHERE id = :payment_id AND provider = 'stripe' AND status <> 'completed'
            """
        ),
        {"payment_id": payment_id, "failure_code": failure_code},
    )


def _record_refund(db: Session, stripe_object) -> None:
    payment_intent = str(stripe_object.get("payment_intent") or "")
    if not payment_intent:
        return
    payment = db.execute(
        text(
            """
            SELECT p.id, p.invoice_id, p.amount, p.currency, p.refunded_amount,
                   i.organization_id, i.client_id, i.case_id
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            WHERE p.provider = 'stripe' AND p.provider_payment_id = :payment_intent
            FOR UPDATE OF p, i
            """
        ),
        {"payment_intent": payment_intent},
    ).mappings().first()
    if payment is None:
        return

    refunded_amount = _money(
        Decimal(int(stripe_object.get("amount_refunded") or 0)) / 100
    )
    if str(stripe_object.get("currency") or "").upper() != str(payment["currency"]).upper():
        return
    previous_refund = _money(Decimal(payment["refunded_amount"] or 0))
    refunded_amount = min(refunded_amount, _money(Decimal(payment["amount"])))
    refund_delta = refunded_amount - previous_refund
    if refund_delta <= 0:
        return

    fully_refunded = refunded_amount >= _money(Decimal(payment["amount"]))
    db.execute(
        text(
            """
            UPDATE payments
            SET refunded_amount = :refunded_amount,
                refunded_at = NOW(),
                status = :status,
                updated_at = NOW()
            WHERE id = :payment_id
            """
        ),
        {
            "refunded_amount": refunded_amount,
            "status": "refunded" if fully_refunded else "completed",
            "payment_id": str(payment["id"]),
        },
    )
    db.execute(
        text(
            """
            UPDATE invoices
            SET amount_paid = GREATEST(0, amount_paid - :refund_delta),
                paid_date = CASE WHEN amount_paid - :refund_delta <= 0 THEN NULL ELSE paid_date END,
                status = CASE
                    WHEN amount_paid - :refund_delta <= 0 THEN 'refunded'
                    ELSE 'viewed'
                END,
                updated_at = NOW()
            WHERE id = :invoice_id
            """
        ),
        {"refund_delta": refund_delta, "invoice_id": str(payment["invoice_id"])},
    )
    log_activity(
        db,
        organization_id=payment["organization_id"],
        user_id=None,
        action="payment_refunded",
        entity_type="payment",
        entity_id=payment["id"],
        case_id=payment["case_id"],
        client_id=payment["client_id"],
        new_values={
            "invoice_id": str(payment["invoice_id"]),
            "refunded_amount": str(refunded_amount),
            "currency": str(payment["currency"]),
        },
    )
