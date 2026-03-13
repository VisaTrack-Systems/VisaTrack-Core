# Audit-Ready Checklist (SOC 1 + SOC 2) — Database-Only

This checklist maps control objectives to database-level implementation so auditors can verify each item. All evidence is migration names, table/trigger names, or application paths.

---

## SOC 2 Alignment Checks

### 1. RLS enabled for tenant isolation

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | RLS enabled on tenant tables; policies use `app.org_id` (and `app.bypass_rls` for super_admin). | `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('cases','case_documents','messages','invoices','payments','trust_account_entries','data_deletion_requests','consents');` — `rowsecurity` = true. Policies: `SELECT * FROM pg_policies WHERE tablename IN (...);` |

**Tables with RLS:**  
`add_rls_high_risk_tables.py` (b2c3d4e5f6a7): cases, case_documents, messages, invoices, payments, trust_account_entries.  
`phase2_rls_org_user_role_policies.py` (d4e5f6a7b8c9): same tables, policies updated to use `app.org_id`, `app.user_id`, `app.role` (cases get client/lawyer policies).  
`phase5_privacy_lifecycle_retention_deletion_legal_hold.py` (a7b8c9d0e1f2): data_deletion_requests, consents.

**Session variables set per request:** `backend/app/api/deps/auth.py` — `set_config('app.org_id', ...)`, `set_config('app.user_id', ...)`, `set_config('app.role', ...)`, `set_config('app.bypass_rls', ...)`.

---

### 2. organization_id NOT NULL on all tenant tables

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | Child tables backfilled and set NOT NULL in migration. | `SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND table_name IN ('cases','case_documents','messages','invoices','payments',...);` — `is_nullable` = 'NO' for tenant tables. |

**Evidence:** `add_organization_id_to_child_tables.py` (a1b2c3d4e5f6): backfill from parent, then `ALTER COLUMN organization_id SET NOT NULL` for case_documents, case_assignments, messages, milestones, case_clients, document_access_log, invoices, invoice_items, payment_methods, payments, notifications (where tables exist).

---

### 3. Cross-table org consistency enforced for all FKs

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | Triggers ensure inserted/updated rows have `organization_id` matching parent (case, user, or invoice). | List triggers: `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%org%' OR tgname LIKE '%consistency%';` |

**Evidence:** `phase1_tenant_isolation_triggers_and_indexes.py` (c3d4e5f6a7b8): case_documents (uploader in case org), case_assignments (lawyer in case org), case_clients (client in case org), document_access_log (user in doc’s case org), messages (sender/recipient in case org), payments (invoice org + payment_method client = invoice client), notifications (user in row org). `add_organization_id_to_child_tables.py`: triggers for document_id → case_documents.organization_id, etc.

---

### 4. Audit logs immutable and complete

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | activity_log: UPDATE/DELETE blocked by trigger. Optional changed_fields and sensitivity_level. | `SELECT proname FROM pg_proc p JOIN pg_trigger t ON t.tgfoid = p.oid WHERE t.tgrelid = 'activity_log'::regclass;` — expect `activity_log_immutable`. Attempt `UPDATE activity_log SET action = 'x' WHERE id = (SELECT id FROM activity_log LIMIT 1);` → error. |

**Evidence:** `phase3_activity_log_immutable_and_doc_audit.py` (e5f6a7b8c9d0): trigger `trg_activity_log_immutable`, function `activity_log_immutable()`. Columns: `changed_fields` (TEXT[]), `sensitivity_level` (VARCHAR). Application: `app/services/audit.py` — `log_activity()` writes redacted old/new/metadata and optional changed_fields/sensitivity_level.

---

### 5. Document access log covers all reads/downloads

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | document_access_log populated for view (download URL), download (single + bulk zip), upload, approve, reject. | Query `document_access_log` for action in ('view','download','upload','approve','reject'). Code paths: `app/api/routes/cases.py` — get_case_document_download_url (view), download single, download_all_case_documents (bulk), complete_case_document_upload (upload), update_case_document_status (approve/reject when case_document exists). |

**Evidence:** `app/services/audit.py` — `log_document_access(..., action=...)`. Phase 3 migration adds/uses document_access_log; no DB trigger for “all reads” — application must call `log_document_access` at every read/download/upload/approve/reject.

---

### 6. PII not duplicated into logs

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | activity_log receives only redacted payloads; sensitive keys replaced with `[REDACTED]`. | Inspect `activity_log.old_values`, `new_values`, `metadata` — no raw DOB, UCI, email, address, etc. |

**Evidence:** `app/services/audit.py`: `SENSITIVE_KEYS` (date_of_birth, uci, sin, passport_number, application_number, address, phone, email, password, etc.). `_redact_sensitive()` applied to old_values, new_values, metadata before INSERT in `log_activity()`. Keys kept; values replaced with `REDACTED_PLACEHOLDER`.

---

### 7. Encryption strategy defined (at rest + field-level for high sensitivity)

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Defined** | At rest: use platform-managed encryption (e.g. PostgreSQL TDE / cloud disk encryption). Field-level: high-sensitivity data not stored in logs; application may encrypt specific columns per policy. | No DB objects enforce encryption; strategy is organizational. Document: (1) At rest = provider/OS/DB encryption. (2) Field-level = no UCI/DOB/passport in activity_log; sensitive columns encrypted at app layer if required by policy. |

**Evidence:** Database does not store encryption keys. PII redaction (see item 6) prevents sensitive values in logs. Any field-level encryption for columns (e.g. SSN, UCI) is an application/infra decision; DB supports NOT NULL and constraints only.

---

## SOC 1 Alignment Checks

### 8. Invoices immutable after sent

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | When invoice status is not draft (and not voided), updates to totals, tax, currency, and amount_paid are blocked. Line items cannot be added/updated/deleted after send. | Trigger: `trg_invoices_immutable_after_sent`, `trg_invoice_items_immutable_after_sent`. Try `UPDATE invoices SET total_amount = 0 WHERE status = 'sent';` → error. |

**Evidence:** `phase4_financial_integrity_soc1.py` (f6a7b8c9d0e1): `invoices_immutable_after_sent()`, `invoice_items_immutable_after_sent()`. Blocks: total_amount, amount_due, amount_paid, tax, currency (if columns exist); and any INSERT/UPDATE/DELETE on invoice_items when parent invoice status != 'draft'.

---

### 9. Adjustments/credit notes are append-only

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | invoice_events table is append-only (no UPDATE/DELETE). Edits after send are blocked; adjustments are expected as new events/records. | Trigger on invoice_events: `trg_invoice_events_append_only`. Try `DELETE FROM invoice_events WHERE id = (SELECT id FROM invoice_events LIMIT 1);` → error. |

**Evidence:** `phase4_financial_integrity_soc1.py`: table `invoice_events` (event_type: invoice_created, sent, viewed, line_item_added, adjusted, voided, paid, refunded). Function `invoice_events_append_only()` raises on UPDATE/DELETE.

---

### 10. Payments idempotent + unique provider transaction IDs

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | Unique index on (provider, provider_payment_id) where provider_payment_id is not null/empty. Optional column idempotency_key on payments. | `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'payments' AND indexname LIKE '%provider%';` — unique index on (provider, provider_payment_id). Column: `idempotency_key`. |

**Evidence:** `phase4_financial_integrity_soc1.py`: `ix_payments_provider_provider_payment_id` UNIQUE; column `idempotency_key` (VARCHAR(255)) added to payments.

---

### 11. Invoice payment totals reconciled from payments

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | invoices.amount_paid is updated only by trigger on payments when status becomes completed/paid or refunded. Direct UPDATE of amount_paid is blocked. | Triggers: `trg_payments_sync_invoice_amount_paid`, `trg_invoices_amount_paid_readonly`. Try `UPDATE invoices SET amount_paid = 100 WHERE id = (SELECT id FROM invoices LIMIT 1);` → error (unless session set app.allow_amount_paid_update by payment trigger). |

**Evidence:** `phase4_financial_integrity_soc1.py`: `payments_sync_invoice_amount_paid()` — on payment INSERT/UPDATE, computes delta and UPDATE invoices SET amount_paid = amount_paid + delta (only when `set_config('app.allow_amount_paid_update','true',true)` is set by that trigger). `invoices_amount_paid_readonly()` blocks direct amount_paid change unless allow flag set.

---

### 12. Trust ledger append-only + events for reconcile/void

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Implemented** | trust_entry_events table is append-only; events record reconcile/void. Main ledger (trust_account_entries) append-only by policy; event trail provides evidence. | Trigger: `trg_trust_entry_events_append_only` on trust_entry_events. Table trust_entry_events (event_type, trust_entry_id, occurred_at, actor_user_id, metadata). |

**Evidence:** `phase4_financial_integrity_soc1.py`: table `trust_entry_events`, function `trust_entry_events_append_only()`. Application should INSERT into trust_entry_events for void/reconcile and rely on trust_account_entries being written only by designated paths (append-only in practice; no DB trigger on trust_account_entries in this migration).

---

### 13. Clear roles/permissions for billing actions (segregation of duties)

| Status | Evidence | How to verify |
|--------|----------|----------------|
| **Defined (DB supports)** | Session exposes app.role (client, lawyer, org_admin, super_admin) and permissions; billing actions should be restricted by role/permission in application layer. | `SELECT set_config('app.role','lawyer',true);` etc. Roles/permissions in `users` / `user_roles` / `roles`; RLS limits which rows a role sees. Billing-specific permission checks are in API (require_roles / require_permissions). |

**Evidence:** `backend/app/api/deps/auth.py`: `app.role` and `app.user_id` set per request; `require_roles()`, `require_permissions()`. Database stores roles and permissions; application enforces “who can create invoices / record payments” via these dependencies. No DB-level “only role X can INSERT into payments” — segregation is application-enforced with DB providing role/org context.

---

## Verification Queries (run as auditor)

```sql
-- RLS enabled on tenant tables
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('cases','case_documents','messages','invoices','payments','trust_account_entries','data_deletion_requests','consents')
ORDER BY 1;

-- organization_id NOT NULL on key tables
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'organization_id'
  AND table_name IN ('case_documents','invoices','payments','messages','case_clients','case_assignments')
ORDER BY table_name;

-- Immutable audit log trigger
SELECT t.tgname, p.proname
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'activity_log' AND NOT t.tgisinternal;

-- Invoice immutability triggers
SELECT tgrelid::regclass, tgname FROM pg_trigger
WHERE tgname IN ('trg_invoices_immutable_after_sent','trg_invoice_items_immutable_after_sent','trg_invoice_events_append_only');

-- Payment idempotency and invoice amount_paid
SELECT tgrelid::regclass, tgname FROM pg_trigger
WHERE tgname IN ('trg_payments_sync_invoice_amount_paid','trg_invoices_amount_paid_readonly');
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'payments' AND indexname LIKE '%provider%';

-- Trust entry events append-only
SELECT tgrelid::regclass, tgname FROM pg_trigger WHERE tgrelid = 'trust_entry_events'::regclass;
```

---

## Summary Table

| # | Control | SOC | Status |
|---|---------|-----|--------|
| 1 | RLS for tenant isolation | 2 | Implemented |
| 2 | organization_id NOT NULL on tenant tables | 2 | Implemented |
| 3 | Cross-table org consistency (FKs) | 2 | Implemented |
| 4 | Audit logs immutable and complete | 2 | Implemented |
| 5 | Document access log covers reads/downloads | 2 | Implemented |
| 6 | PII not duplicated into logs | 2 | Implemented |
| 7 | Encryption strategy defined | 2 | Defined |
| 8 | Invoices immutable after sent | 1 | Implemented |
| 9 | Adjustments/credit notes append-only | 1 | Implemented |
| 10 | Payments idempotent + unique provider IDs | 1 | Implemented |
| 11 | Invoice totals reconciled from payments | 1 | Implemented |
| 12 | Trust ledger append-only + events | 1 | Implemented |
| 13 | Roles/permissions for billing (segregation) | 1 | Defined (DB supports) |
