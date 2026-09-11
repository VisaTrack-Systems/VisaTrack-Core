# Audit Remediation Issue Backlog

These issue bodies cover audit work that requires product decisions,
infrastructure, production access, legal review, or larger architectural
changes. They are ready to copy into GitHub Issues.

Code fixes already proposed:

- Authentication and authorization hardening: PR #164
- Client-data and outbound-email protections: PR #165
- Secure bounded document uploads: PR #166
- Dependency and CI hardening: PR #167
- Frontend security and accessibility: PR #168
- Database and concurrency reliability: PR #169

## 1. Implement revocable sessions and secure browser authentication

**Suggested labels:** `security`, `backend`, `frontend`, `P1`

### Context

Bearer access tokens are persisted in browser `localStorage`; logout only
clears browser state, and password changes cannot invalidate previously issued
tokens. A complete session lifecycle needs a product and deployment design
rather than a local patch.

### Acceptance criteria

- [ ] Access tokens are short-lived and are not persisted in `localStorage`.
- [ ] Refresh credentials use `Secure`, `HttpOnly`, appropriately scoped
      `SameSite` cookies or an approved backend-for-frontend design.
- [ ] Refresh tokens rotate on every use and reuse revokes the token family.
- [ ] Logout, password change, account disablement, and role revocation
      invalidate relevant sessions.
- [ ] CSRF protections are documented and tested for every cookie-authenticated
      write.
- [ ] Sessions can be viewed and revoked by the user and administrators.
- [ ] Security events are audited without logging raw credentials.
- [ ] Threat-model and integration tests cover theft, replay, fixation, reuse,
      and concurrent refresh.

## 2. Implement enforceable MFA for privileged accounts

**Suggested labels:** `security`, `authentication`, `P1`

### Context

The existing MFA field is not backed by enrollment or login verification. PR
#164 prevents new false-positive enrollment; this issue delivers the complete
control.

### Acceptance criteria

- [ ] TOTP and/or WebAuthn enrollment requires recent password
      reauthentication.
- [ ] Enrollment is enabled only after a valid verification challenge.
- [ ] TOTP secrets are encrypted with a managed key; WebAuthn credentials use
      appropriate counters and origin/RP validation.
- [ ] One-time recovery codes are hashed, shown once, and individually
      revocable.
- [ ] Login, recovery, and enrollment endpoints have dedicated rate limits and
      audit events.
- [ ] MFA is mandatory for `org_admin` and `super_admin`.
- [ ] Account recovery is documented and resistant to support-channel social
      engineering.

## 3. Add document quarantine, malware scanning, and retention enforcement

**Suggested labels:** `security`, `documents`, `aws`, `P1`

### Context

PR #166 enforces type/size policies but malware scanning and lifecycle
enforcement require asynchronous workers and real cloud resources.

### Acceptance criteria

- [ ] New objects enter a private quarantine prefix/bucket and cannot receive
      download URLs.
- [ ] A managed scanner or isolated worker validates magic bytes, scans for
      malware, and records engine/signature versions.
- [ ] Only clean objects are promoted; failed or timed-out scans are denied.
- [ ] Public access blocking, mandatory KMS encryption, least-privilege IAM,
      versioning, access logging, and lifecycle rules are verified in IaC.
- [ ] Soft-deleted database documents are purged from storage according to
      retention/legal-hold rules with idempotent retry and evidence.
- [ ] Alerts cover scan failures, queue age, oversized attempts, and unusual
      storage growth.
- [ ] EICAR and malformed-format integration tests run in an isolated test
      environment.

## 4. Create immutable audit logging and security monitoring

**Suggested labels:** `security`, `observability`, `compliance`, `P1`

### Context

Application audit tables are mutable by the application database role, event
coverage is incomplete, and no immutable export or alert policy is represented.

### Acceptance criteria

- [ ] An event catalog defines required actors, actions, targets, tenant,
      result, request ID, source, and redaction for privileged/security events.
- [ ] The application role can append but cannot update/delete audit records.
- [ ] Audit events are exported to immutable storage or a SIEM with integrity
      and retention controls.
- [ ] Alerts cover privilege changes, repeated authentication failures,
      cross-tenant denials, bulk downloads, export/delete operations, and
      security configuration changes.
- [ ] Raw tokens, invitation URLs, passwords, MFA secrets, document contents,
      and unnecessary personal data are never logged.
- [ ] Clock synchronization, access reviews, retention, legal hold, and
      evidence-export procedures are documented and exercised.

## 5. Establish production observability, readiness, and incident response

**Suggested labels:** `operations`, `observability`, `reliability`, `P2`

### Acceptance criteria

- [ ] Every request has a propagated correlation ID and structured, redacted
      logs.
- [ ] Metrics cover request rate/errors/latency, DB pool saturation and slow
      queries, S3 operations, mail delivery, queues, and authentication events.
- [ ] Tracing covers API, database, object storage, email, and background jobs.
- [ ] Liveness and readiness are separate; readiness uses bounded database and
      required-configuration checks.
- [ ] SLOs and alert thresholds are defined for core case/document workflows.
- [ ] Dashboards, on-call ownership, runbooks, and incident severity/escalation
      procedures exist.
- [ ] A tabletop incident and a production-like failure exercise are completed.

## 6. Add PostgreSQL integration, browser E2E, accessibility, and load tests

**Suggested labels:** `testing`, `quality`, `P2`

### Acceptance criteria

- [ ] CI boots a clean PostgreSQL instance, applies Alembic to head, and runs
      API integration tests.
- [ ] Tenant-isolation and IDOR tests cover every resource type and role.
- [ ] Concurrency tests cover case numbering, invitation acceptance, login
      lockout, and case/document JSON state.
- [ ] Playwright covers sign-in, invitations, role switching, case workflows,
      document upload/download, and administrative actions.
- [ ] Automated axe checks and manual keyboard/screen-reader checks cover all
      dialogs and critical workflows against WCAG 2.2 AA.
- [ ] Coverage is published and enforced for security-critical modules.
- [ ] Load tests establish limits for dashboards, uploads, bulk archives, and
      concurrent users.

## 7. Build reproducible production deployment and disaster recovery

**Suggested labels:** `devops`, `infrastructure`, `reliability`, `P1`

### Acceptance criteria

- [ ] Hardened, non-root, minimal frontend/backend images are reproducibly
      built, scanned, signed, and associated with SBOM/provenance.
- [ ] IaC defines networks, compute, PostgreSQL, S3/KMS, secrets, email, DNS,
      TLS, WAF/rate limiting, logs, alerts, and least-privilege IAM.
- [ ] Deployment uses health-gated rollout and tested rollback.
- [ ] PostgreSQL encryption, automated backups, point-in-time recovery, and
      multi-zone requirements are documented.
- [ ] S3 versioning, replication requirements, and recovery procedures are
      documented.
- [ ] RPO/RTO values are approved; restore drills prove both within target.
- [ ] Development setup has either a working Compose/devcontainer path or
      explicitly documented supported prerequisites.

## 8. Complete privacy, records-management, and legal review

**Suggested labels:** `privacy`, `compliance`, `legal`, `P1`

### Context

VisaTrack processes identity, immigration, legal, document, and financial
information. Applicable obligations depend on customers, provinces,
subprocessors, and deployment locations and require qualified counsel.

### Acceptance criteria

- [ ] A data inventory maps fields, sensitivity, purpose, lawful authority,
      source, recipients, subprocessors, residency, and retention.
- [ ] Privacy counsel confirms applicable Canadian federal/provincial and
      professional obligations.
- [ ] Privacy notice, consent/authority records, data-processing terms, and
      subprocessor disclosures are approved.
- [ ] Access, correction, export, deletion, legal hold, and account closure
      workflows are implemented and tested.
- [ ] Retention schedules cover database rows, objects, versions, logs,
      backups, audit records, and support reports.
- [ ] A privacy impact assessment and breach-response procedure are approved.
- [ ] Production access and subprocessor reviews occur on a documented cadence.

## 9. Normalize case workflow state and split the case service

**Suggested labels:** `architecture`, `backend`, `database`, `P2`

### Context

The case route module is very large and stores portal permissions, custom
documents, upload bindings, status overrides, and rejection notes in one JSONB
read-modify-write surface. PR #169 adds locking as an interim safety control.

### Acceptance criteria

- [ ] Document requests, suites, portal permissions, and upload bindings move to
      normalized tables with tenant-aware foreign keys and constraints.
- [ ] A migration preserves and validates every existing JSONB value.
- [ ] Optimistic concurrency/version semantics are defined for user edits.
- [ ] Routes are split into policy, command, query, document, billing, and
      serialization services with explicit transactions.
- [ ] Client-safe and internal response DTOs are distinct types.
- [ ] Property-based and concurrent integration tests cover state transitions.
- [ ] Query plans and indexes are reviewed using production-like volumes.

## 10. Add asynchronous jobs for email, scanning, reminders, and exports

**Suggested labels:** `architecture`, `reliability`, `backend`, `P2`

### Acceptance criteria

- [ ] A managed queue and worker model is selected with tenant-aware payloads.
- [ ] Jobs are idempotent and use bounded exponential retry with jitter.
- [ ] Dead-letter handling, replay, cancellation, and operator tooling exist.
- [ ] Email, malware scanning, reminder delivery, and bulk archive/export work
      execute outside API request workers.
- [ ] Queue depth/age, attempts, failures, and poison messages are monitored.
- [ ] User-facing status and retry behavior is defined for every asynchronous
      workflow.

## 11. Finish frontend accessibility migration

**Suggested labels:** `frontend`, `accessibility`, `P2`

### Context

PR #168 introduces an accessible dialog primitive and migrates the highest-risk
dialogs. Remaining overlays and forms must be converted systematically.

### Acceptance criteria

- [ ] Every modal uses the shared dialog primitive with accessible name,
      description where needed, focus trap/restoration, Escape, and initial
      focus.
- [ ] Every form control has a programmatic label and useful autocomplete/input
      metadata.
- [ ] Status is never communicated by color alone.
- [ ] All interactive controls have visible keyboard focus and adequate target
      size.
- [ ] Automated axe and manual NVDA/VoiceOver/keyboard results are attached.
- [ ] Reduced motion, zoom/reflow, contrast, errors, and mobile behavior meet
      WCAG 2.2 AA.

## 12. Formalize API lifecycle and security architecture

**Suggested labels:** `api`, `architecture`, `security`, `P2`

### Acceptance criteria

- [ ] A deny-by-default authorization matrix maps role, active role,
      permission, tenant relationship, resource state, and action.
- [ ] OpenAPI is the source for generated frontend API types.
- [ ] Pagination envelopes, limits, filtering, errors, and correlation IDs are
      consistent.
- [ ] Idempotency keys protect retried create/payment/email operations.
- [ ] Optimistic concurrency protects user-editable resources.
- [ ] Versioning, compatibility, and deprecation policy is documented.
- [ ] Threat models are maintained for authentication, invitations, documents,
      tenant isolation, administrative delegation, and financial records.
