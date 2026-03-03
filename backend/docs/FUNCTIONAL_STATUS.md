# Functional Status — SOC / Audit Implementation

Summary of what is **working**, **conditional**, and **to be wired** after migrations.

---

## Working (no extra wiring)

| Area | What | Evidence |
|------|------|----------|
| **Tenant isolation** | organization_id on tenant tables + NOT NULL | Migration a1b2c3d4e5f6 |
| **Org consistency** | Triggers enforce parent org on INSERT/UPDATE | Phase 1 triggers (case_documents, messages, payments, etc.) |
| **RLS** | RLS enabled; policies use app.org_id, app.user_id, app.role | add_rls + Phase 2 + Phase 5; auth sets session vars every request |
| **Audit logs** | activity_log immutable; PII redacted before insert | Phase 3 trigger; audit.py `_redact_sensitive()`, `log_activity()` |
| **Document access log** | View, download (single + bulk), upload, approve, reject logged | cases.py calls `log_document_access()` at each path |
| **Invoice lock** | Invoices/items immutable after sent; amount_paid only from payments | Phase 4 triggers (if invoices/payments tables exist) |
| **Payment idempotency** | Unique (provider, provider_payment_id); idempotency_key column | Phase 4 (if payments table exists) |
| **Reconciliation** | invoices.amount_paid updated only by payment status trigger | Phase 4 triggers |
| **Retention / legal hold** | DB trigger blocks hard DELETE; **app blocks soft-delete** when legal_hold or retain_until | Phase 5 columns + trigger; cases.py `delete_case_document` checks before UPDATE |

---

## Conditional (depends on schema)

- **Phase 4 (financial):** All invoice/payment/trust triggers and tables are gated by `_table_exists` / `_column_exists`. If your DB has no `invoices`, `payments`, or `trust_account_entries`, those migrations no-op for those objects. Once you add those tables (and columns like `provider`, `provider_payment_id`, `invoice_id`, `amount_paid`), re-run or ensure migrations have run so triggers and constraints apply.
- **Phase 3 (activity_log):** If `activity_log` table does not exist, Phase 3 upgrade no-ops. When you add it, run migrations to get immutability and new columns.
- **Phase 5 (retention):** If `case_documents` exists, columns and trigger are added. The app treats missing `legal_hold`/`retain_until` columns gracefully (ProgrammingError for “column does not exist” is caught and retention check is skipped).

---

## To be wired (application responsibility)

These are **database-ready** but the app does **not** yet insert or drive them; add when you implement the features.

| Item | Purpose | Action |
|------|---------|--------|
| **invoice_events** | Append-only trail (created, sent, viewed, adjusted, voided, paid, refunded) | When creating/sending/viewing/adjusting/voiding invoices or recording payment, INSERT a row into `invoice_events`. |
| **trust_entry_events** | Append-only trail for void/reconcile on trust entries | When voiding or reconciling a trust entry, INSERT a row into `trust_entry_events`. |
| **data_deletion_requests** | Track “delete my data” requests, scope, status, approved_by | Create/update rows when handling deletion requests and approvals. |
| **consents** | Record consent for extraction or other features | INSERT/UPDATE when user grants/revokes consent. |
| **legal_hold / retain_until** | Set per document | Expose in API/admin so staff can set `legal_hold` and `retain_until` on case_documents (the delete path already enforces them). |

---

## Migration order

Ensure migrations run in order (e.g. `alembic upgrade head`):

1. e92b3ac1b42b (baseline)  
2. a1b2c3d4e5f6 (org_id + triggers)  
3. b2c3d4e5f6a7 (RLS)  
4. c3d4e5f6a7b8 (Phase 1 tenant triggers/indexes)  
5. d4e5f6a7b8c9 (Phase 2 RLS policies)  
6. e5f6a7b8c9d0 (Phase 3 activity_log + doc audit)  
7. f6a7b8c9d0e1 (Phase 4 financial)  
8. a7b8c9d0e1f2 (Phase 5 retention/legal hold)

---

## Quick verification

- **RLS:** Every request that uses the DB should go through auth, which sets `app.org_id` / `app.user_id` / `app.role` (and `app.bypass_rls` for super_admin). No raw connections that skip auth.
- **Audit:** All mutation endpoints that change important state call `log_activity()` with appropriate entity_type/action; document access paths call `log_document_access()`.
- **Document delete:** Deleting a document with `legal_hold = true` or `retain_until` in the future returns **409 Conflict** and the document is not soft-deleted.

**Bottom line:** With migrations applied and PostgreSQL available, tenant isolation, RLS, immutable and redacted logs, invoice lock, payment uniqueness and reconciliation, and retention/legal hold enforcement are **functional**. Invoice/trust event tables and deletion/consent workflows are in place in the DB and need to be wired in the application where those features are implemented.
