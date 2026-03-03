# Retention and Deletion Policy (Phase 5 — Privacy Lifecycle)

This document defines what is **deletable** vs **must be retained** so you can prove retention and deletion behavior to clients and auditors.

## Legal hold and retain_until

- **`case_documents.legal_hold`** (boolean): When `true`, the document must not be deleted until the hold is lifted.
- **`case_documents.retain_until`** (date): Document must not be deleted before this date.

The database enforces this: a `BEFORE DELETE` trigger on `case_documents` raises an error if:
- `legal_hold = true`, or
- `retain_until` is set and `retain_until > current_date`.

## What must be retained (not deletable for compliance)

| Category   | Tables / scope              | Rule        | Reason |
|-----------|-----------------------------|-------------|--------|
| Financial | invoices, invoice_items    | Indefinite  | Billing/audit |
| Financial | payments                   | Indefinite  | Payment trail |
| Financial | trust_account_entries      | Indefinite  | Trust ledger |
| Financial | invoice_events             | Indefinite  | Invoice event trail |
| Financial | trust_entry_events          | Indefinite  | Trust event trail |
| Requests  | data_deletion_requests      | Indefinite  | Audit of who requested what |
| Consents  | consents                   | Indefinite  | Consent history |

**Implementation:** Do not hard-delete these rows. Data deletion requests (see below) should **exclude** financial and request/consent tables from scope, or only anonymize/redact where legally allowed.

## What is deletable (with conditions)

| Category   | Tables / scope     | Rule                         | Condition |
|-----------|--------------------|------------------------------|-----------|
| Documents | case_documents     | retain_until + legal_hold    | Delete only when `legal_hold = false` and (`retain_until` is null or `retain_until <= current_date`). |
| Documents | document_access_log| Follow document              | Retain as long as the related document; can be purged when the document is eligible for deletion. |

## Data deletion requests

The **`data_deletion_requests`** table tracks:

- **Requester** (`requester_user_id`), **subject** (`subject_type`, `subject_id`), **scope** (e.g. `all_case_data`, `documents_only`, `pii_only`)
- **Status**: `pending`, `approved`, `rejected`, `completed`, `cancelled`
- **Approval**: `approved_by`, `approved_at`, `completed_at`, `notes`

**Proving behavior:** Query `data_deletion_requests` to show who requested deletion, what scope, who approved, and when it was completed. When executing a request, only delete or anonymize data that is **deletable** per the table above; never delete financial/trust/request/consent rows.

## Consents

The **`consents`** table records consent for features (e.g. intelligent extraction):

- **Subject** (`subject_type`, `subject_id`), **consent_type**, **granted**, **granted_at**, **granted_by**, **revoked_at**, **metadata**

Use this to prove that extraction or other processing was done only with recorded consent.

## Reference data in the database

Table **`retention_policy_definitions`** stores the same categorization (category, table_or_scope, retention_rule, retain_years, description) so retention rules are queryable and auditable from the DB.
