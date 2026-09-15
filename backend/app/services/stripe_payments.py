"""Narrow Stripe adapter for hosted Checkout and signed webhooks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import stripe

from app.core.config import settings


class StripeConfigurationError(RuntimeError):
    pass


class StripeOperationError(RuntimeError):
    pass


class StripeSignatureError(ValueError):
    pass


@dataclass(frozen=True)
class HostedCheckout:
    session_id: str
    url: str
    expires_at: datetime


def create_hosted_checkout(
    *,
    amount_minor: int,
    currency: str,
    invoice_number: str,
    customer_email: str,
    payment_id: str,
    invoice_id: str,
    organization_id: str,
    idempotency_key: str,
) -> HostedCheckout:
    if not settings.stripe_secret_key:
        raise StripeConfigurationError("Stripe payments are not configured")

    frontend_origin = settings.frontend_origins[0].rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            customer_email=customer_email,
            line_items=[
                {
                    "price_data": {
                        "currency": currency,
                        "product_data": {
                            "name": f"VisaTrack invoice {invoice_number}",
                        },
                        "unit_amount": amount_minor,
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "payment_id": payment_id,
                "invoice_id": invoice_id,
                "organization_id": organization_id,
            },
            payment_intent_data={
                "metadata": {
                    "payment_id": payment_id,
                    "invoice_id": invoice_id,
                    "organization_id": organization_id,
                }
            },
            success_url=(
                f"{frontend_origin}/?payment=success"
                "&session_id={CHECKOUT_SESSION_ID}"
            ),
            cancel_url=f"{frontend_origin}/?payment=cancelled",
            idempotency_key=idempotency_key,
            api_key=settings.stripe_secret_key,
        )
    except stripe.StripeError as exc:
        raise StripeOperationError("Stripe could not create a checkout session") from exc

    session_id = str(session.get("id") or "")
    url = str(session.get("url") or "")
    expires_at_raw = session.get("expires_at")
    if not session_id or not url or not expires_at_raw:
        raise StripeOperationError("Stripe returned an incomplete checkout session")

    return HostedCheckout(
        session_id=session_id,
        url=url,
        expires_at=datetime.fromtimestamp(int(expires_at_raw), tz=timezone.utc),
    )


def construct_webhook_event(payload: bytes, signature: str) -> dict[str, Any]:
    if not settings.stripe_webhook_secret:
        raise StripeConfigurationError("Stripe webhooks are not configured")
    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise StripeSignatureError("Invalid Stripe webhook signature") from exc
    return dict(event)
