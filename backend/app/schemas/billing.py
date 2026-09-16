"""Validated invoice and Stripe Checkout API contracts."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field

Money = Annotated[Decimal, Field(ge=Decimal("0"), max_digits=12, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=Decimal("0"), max_digits=12, decimal_places=2)]


class InvoiceLineItemCreate(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"), gt=0, max_digits=10, decimal_places=2)
    unit_price: PositiveMoney
    category: str | None = Field(default=None, max_length=100)


class InvoiceCreateRequest(BaseModel):
    due_date: date
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1, decimal_places=4)
    notes: str | None = Field(default=None, max_length=5000)
    terms: str | None = Field(default=None, max_length=5000)
    items: list[InvoiceLineItemCreate] = Field(min_length=1, max_length=50)


class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    status: str
    subtotal: Money
    tax_rate: Decimal
    tax_amount: Money
    total_amount: Money
    amount_paid: Money
    amount_due: Money
    currency: str
    issue_date: date
    due_date: date


class CheckoutSessionResponse(BaseModel):
    payment_id: UUID
    checkout_url: str
    expires_at: datetime


class StripeWebhookResponse(BaseModel):
    received: bool = True
