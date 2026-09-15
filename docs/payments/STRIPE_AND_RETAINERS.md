# Stripe payments and lawyer-provided documents

## Payment flow

VisaTrack uses Stripe-hosted Checkout. VisaTrack never accepts or stores card numbers,
CVC values, or raw payment credentials.

1. A lawyer assigned to a case, an organization administrator, or a super administrator
   creates an invoice from the case's **Payments & Invoices** section.
2. The client sees the outstanding invoice in the client portal and selects **Make
   Payment**.
3. The API creates one Stripe Checkout Session for the invoice's current outstanding
   balance. `Idempotency-Key` is required for invoice and Checkout creation, and an
   unexpired Checkout Session is reused.
4. Stripe redirects the client back to VisaTrack after Checkout.
5. Only a signed Stripe webhook marks the payment and invoice paid. Browser redirects
   are never treated as proof of payment.

Completed Checkout, failed PaymentIntent, and refund events are reconciled
idempotently. Webhook event IDs and Stripe payment IDs are unique in PostgreSQL.
Amounts and currencies from Stripe must match the pending VisaTrack payment before an
invoice balance is changed.

Configure:

```dotenv
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=cad
```

Register this endpoint in Stripe:

```text
POST https://<api-host>/api/v1/billing/stripe/webhook
```

Subscribe to:

- `checkout.session.completed`
- `payment_intent.payment_failed`
- `charge.refunded`

Use Stripe test mode and test cards in non-production environments. Never place a
secret or webhook signing key in a `NEXT_PUBLIC_` variable. Restrict access to Stripe's
Dashboard and require MFA there.

This integration uses one platform Stripe account. Stripe Connect onboarding and
per-organization settlement are intentionally not implied; introduce Connect before
multiple independent law firms need funds deposited into separate accounts.

## Retainers and firm-provided documents

Lawyers can use **Add Retainer** to create a case retainer and attach its PDF or
DOCX in one flow. They can also create a custom **Fee Agreement** or other firm
document and use its upload action. Lawyer uploads use the same controls as client
documents:

- tenant and case authorization;
- presigned, size-bounded upload directly to the quarantine prefix;
- declared MIME and file-signature validation;
- ClamAV scanning by the durable worker;
- promotion to the encrypted clean prefix only after a clean result;
- no download while scanning or after rejection; and
- document access and activity audit records.

The uploaded example is a legal document containing organization, client, fee,
termination, confidentiality, and signature terms. VisaTrack treats it as a file; it
does not infer legal terms, alter the agreement, or represent that upload alone is an
electronic signature. Use counsel-approved templates. A future e-signature workflow
must preserve the exact signed bytes, signer identity, intent, timestamps, consent,
delivery evidence, and a tamper-evident audit trail.

Run the document worker in every deployed environment:

```bash
python -m app.workers.main
```
