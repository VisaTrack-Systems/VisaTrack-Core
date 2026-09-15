from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import billing
from app.schemas.billing import InvoiceCreateRequest, InvoiceLineItemCreate
from app.services.stripe_payments import HostedCheckout
from tests.support import FakeResult


def test_create_invoice_calculates_money_and_scopes_case(make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    case_id = uuid4()
    client_id = uuid4()
    invoice_id = uuid4()
    invoice_row = {
        "id": invoice_id,
        "invoice_number": "INV-2026-TEST",
        "status": "sent",
        "subtotal": Decimal("200.00"),
        "tax_rate": Decimal("0.1300"),
        "tax_amount": Decimal("26.00"),
        "total_amount": Decimal("226.00"),
        "amount_paid": Decimal("0"),
        "amount_due": Decimal("226.00"),
        "currency": "CAD",
        "issue_date": date.today(),
        "due_date": date.today() + timedelta(days=14),
    }
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "id": case_id,
                    "client_id": client_id,
                    "primary_lawyer_id": auth.user_id,
                    "created_by": auth.user_id,
                }
            ]
        ),
        FakeResult(rows=[invoice_row]),
        FakeResult(),
        FakeResult(),
    ]

    result = billing.create_invoice(
        case_number="C-2026-001",
        payload=InvoiceCreateRequest(
            due_date=date.today() + timedelta(days=14),
            tax_rate=Decimal("0.13"),
            items=[
                InvoiceLineItemCreate(
                    description="Initial retainer installment",
                    quantity=Decimal("2"),
                    unit_price=Decimal("100"),
                )
            ],
        ),
        auth=auth,
        db=db,
    )

    assert result.total_amount == Decimal("226.00")
    assert db.commit.call_count == 1
    case_params = db.execute.call_args_list[0].args[1]
    assert case_params["organization_id"] == str(auth.organization_id)


def test_checkout_uses_stripe_hosted_page_and_idempotency(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=["client"])
    invoice_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "id": invoice_id,
                    "organization_id": auth.organization_id,
                    "client_id": auth.user_id,
                    "invoice_number": "INV-2026-TEST",
                    "status": "sent",
                    "amount_due": Decimal("125.50"),
                    "currency": "CAD",
                    "email": "client@example.com",
                }
            ]
        ),
        FakeResult(),
        FakeResult(),
        FakeResult(),
        FakeResult(),
    ]
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    create_checkout = MagicMock(
        return_value=HostedCheckout(
            session_id="cs_test_123",
            url="https://checkout.stripe.com/c/pay/cs_test_123",
            expires_at=expires_at,
        )
    )
    monkeypatch.setattr(billing, "create_hosted_checkout", create_checkout)

    result = billing.create_checkout_session(
        invoice_id=invoice_id,
        idempotency_key="portal-safe-key",
        auth=auth,
        db=db,
    )

    assert result.checkout_url.startswith("https://checkout.stripe.com/")
    assert create_checkout.call_args.kwargs["amount_minor"] == 12550
    assert db.commit.call_count == 1


def test_checkout_rejects_short_idempotency_key(make_auth_context):
    with pytest.raises(HTTPException) as exc:
        billing.create_checkout_session(
            invoice_id=uuid4(),
            idempotency_key="short",
            auth=make_auth_context(roles=["client"]),
            db=MagicMock(),
        )
    assert exc.value.status_code == 400


def test_completed_checkout_updates_payment_once():
    payment_id = uuid4()
    invoice_id = uuid4()
    organization_id = uuid4()
    client_id = uuid4()
    case_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "id": payment_id,
                    "invoice_id": invoice_id,
                    "amount": Decimal("42.25"),
                    "currency": "CAD",
                    "status": "processing",
                    "organization_id": organization_id,
                    "client_id": client_id,
                    "case_id": case_id,
                }
            ]
        ),
        FakeResult(),
        FakeResult(),
        FakeResult(),
    ]

    billing._complete_checkout(
        db,
        SimpleNamespace(
            get=lambda key, default=None: {
                "payment_status": "paid",
                "metadata": {"payment_id": str(payment_id)},
                "amount_total": 4225,
                "currency": "cad",
                "payment_intent": "pi_123",
            }.get(key, default)
        ),
    )

    payment_update = str(db.execute.call_args_list[1].args[0])
    invoice_update = str(db.execute.call_args_list[2].args[0])
    assert "status = 'completed'" in payment_update
    assert "amount_paid = LEAST" in invoice_update


def test_refund_reduces_invoice_balance():
    payment_id = uuid4()
    invoice_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "id": payment_id,
                    "invoice_id": invoice_id,
                    "amount": Decimal("100.00"),
                    "currency": "CAD",
                    "refunded_amount": Decimal("0"),
                    "organization_id": uuid4(),
                    "client_id": uuid4(),
                    "case_id": uuid4(),
                }
            ]
        ),
        FakeResult(),
        FakeResult(),
        FakeResult(),
    ]

    billing._record_refund(
        db,
        {
            "payment_intent": "pi_123",
            "amount_refunded": 2500,
            "currency": "cad",
        },
    )

    payment_params = db.execute.call_args_list[1].args[1]
    invoice_params = db.execute.call_args_list[2].args[1]
    assert payment_params["refunded_amount"] == Decimal("25.00")
    assert payment_params["status"] == "completed"
    assert invoice_params["refund_delta"] == Decimal("25.00")
