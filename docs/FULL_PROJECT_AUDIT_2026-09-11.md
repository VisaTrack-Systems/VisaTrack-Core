# VisaTrack Full Project Audit

**Audit date:** 2026-09-11  
**Scope:** `develop` at `bc3dd10`  
**Review type:** Static code, configuration, dependency, test, and repository-process review

## Executive summary

VisaTrack has a sensible FastAPI/Next.js structure, consistent tenant filters in many routes, parameterized SQL, short-lived S3 URLs, password hashing, audit events, automated tests, Dependabot, CodeQL configuration, and an SBOM workflow. However, it should **not be treated as production-ready for sensitive immigration and financial data** until the P0 and P1 items below are resolved.

The most urgent issues are:

1. A missing environment variable silently activates a known JWT signing secret, enabling token forgery and potentially `super_admin` access.
2. The production Next.js version has known critical vulnerabilities.
3. A client-authorized case endpoint returns lawyer-only internal notes.
4. Disabled accounts and revoked roles can retain access; authorization also uses every assigned role rather than the selected active role.
5. Document upload limits can be bypassed and uploaded content is not allow-listed or malware-scanned.
6. Database bootstrap and Alembic describe two incompatible migration paths.

This was not a live penetration test, cloud/IAM review, privacy legal opinion, or production database inspection. Runtime infrastructure, AWS policies, TLS, backups, restore procedures, and production secrets must be assessed separately.

## Priority model

- **P0 — immediate:** credible account takeover, sensitive-data disclosure, critical vulnerable production dependency, or release blocker.
- **P1 — before production:** significant abuse, authorization, data integrity, availability, or compliance risk.
- **P2 — planned hardening:** defense in depth, maintainability, observability, performance, and test gaps.
- **P3 — enhancement:** product and engineering improvements after the security baseline is complete.

## Findings

### P0

#### SEC-01 — JWTs use a public fallback signing secret

**Evidence:** `backend/app/core/config.py:24` defaults `AUTH_SECRET_KEY` to `dev-only-change-me`; `.env.example` does not define `AUTH_SECRET_KEY`. `backend/app/core/security.py:120-124` signs and verifies HS256 JWTs with this value. `backend/app/api/deps/auth.py:88-109` accepts roles embedded in the token and grants `*` for `super_admin`.

**Impact:** Any deployment that omits the variable uses a repository-known key. An attacker can forge a valid token for a known user and organization and claim `super_admin`.

**Action:**

- Refuse startup outside explicit local/test environments when the key is missing, short, or equals the development value.
- Add `AUTH_SECRET_KEY`, `APP_ENV`, issuer, and audience to `.env.example` without real values.
- Store production keys in a secrets manager; rotate the current key and invalidate all issued tokens.
- Validate `iss`, `aud`, `sub`, `iat`, `exp`, `nbf`, token type, and an explicit algorithm allow-list.
- Prefer asymmetric signing with key IDs and a documented rotation procedure.

#### DEP-01 — Production Next.js has known critical vulnerabilities

**Evidence:** `frontend/package.json:18` pins Next.js `16.1.6`. On 2026-09-11, `npm audit --omit=dev` reported **1 critical, 3 high, and 1 moderate** production dependency findings. The full audit reported 31 findings and identified Next.js advisories including unauthenticated RCE fixed after the installed version (for example GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4).

**Impact:** Exposure depends on platform and enabled Next.js features, but a vulnerable internet-facing framework is an unacceptable production risk.

**Action:** Upgrade Next.js to a release that resolves all reported advisories (the audit indicates at least `16.3.3` for the cited critical issues), regenerate the lockfile, run the full frontend suite, and make `npm audit --omit=dev --audit-level=high` a required CI gate. Also update Vitest/Storybook; the complete audit found two critical, 15 high, 12 moderate, and two low findings across production and development dependencies.

#### SEC-02 — Client case summary discloses internal notes

**Evidence:** `backend/app/api/routes/cases.py:823-826` authorizes clients on `GET /cases/by-number/{case_number}`. The response sets `internal_notes=case.internal_notes` at `cases.py:895`. `backend/app/schemas/case.py:42-56` exposes the field in the shared response model. The separate workspace route correctly clears it for client-only users at `cases.py:2109-2111`.

**Impact:** Clients can read legal strategy, staff-only comments, or other sensitive case information intended for firm personnel.

**Action:** Use role-specific response DTOs and projections. Never select or serialize `internal_notes` for a client request. Add an API integration test proving the field is absent, not merely `null`, for primary and related clients.

#### AUTH-01 — Organization admins can promote users to platform super-admin

**Evidence:** Organization admins receive both `users:manage` and `roles:manage` in `backend/app/services/rbac.py:16-37`. User creation and role assignment pass the caller-controlled `role_slug` directly to `assign_role_to_user` (`backend/app/api/routes/admin.py:803-860` and `:939-956`) without preventing an organization admin from granting the system-level `super_admin` role. `require_permissions` also treats multiple supplied permissions as **any-of**, not all-of (`backend/app/api/deps/auth.py:131-144`).

**Impact:** Any organization administrator can promote an account to `super_admin`, switch to that role, and gain platform-wide administrative capabilities.

**Action:** Enforce a privilege ceiling centrally: only an already-active `super_admin` may grant or revoke `super_admin`, and no caller may grant permissions above their own delegable set. Make permission dependency semantics explicit as `require_all_permissions`/`require_any_permission`, default sensitive writes to all-of, and add escalation/negative tests.

### P1

#### SEC-03 — Role revocation, account disablement, and active-role least privilege are ineffective

**Evidence:**

- `backend/app/api/deps/auth.py:78-90` unions current database roles with JWT roles, so a removed role remains authorized until token expiry.
- `auth.py:62-74` checks deletion, tenant, and lockout but never rejects `disabled`, `suspended`, `inactive`, or invitation-pending users.
- `auth.py:120-144` authorizes against all roles and uses “any” permission intersection. It does not restrict checks to `active_role`.
- `backend/tests/api/deps/test_auth_deps.py:12-31` explicitly tests and preserves the union behavior.
- Multiple case routes branch on membership in `auth.roles`; a dual-role user can receive inconsistent lawyer/client behavior.

**Impact:** Administrators cannot promptly revoke access. Role switching is largely cosmetic and violates least privilege. A disabled user can continue using an existing token.

**Action:** Make the database the sole role/permission source on each request (or use a short-lived authorization cache with immediate invalidation). Reject every non-active account state. Authorize with the selected active role only. Add a per-user `token_version` or `session_revoked_at` and a unique JWT ID for emergency revocation. Add tests for role removal, user disablement, password change, invitation state, dual-role users, and active-role switching.

#### SEC-04 — MFA can be enabled without enrollment or verification

**Evidence:** `backend/app/api/routes/auth.py:258-261` lets a user set `mfa_enabled`; no route enrolls a secret, verifies a one-time code, supplies recovery codes, or challenges MFA during login. `backend/app/models/user.py:35-36` merely stores the flag and secret.

**Impact:** The UI/API can claim MFA is enabled while authentication remains single-factor, creating a dangerous false assurance.

**Action:** Hide/disable the control until a complete TOTP or WebAuthn flow exists. Enrollment must require password reauthentication, secret verification, encrypted secret storage, recovery codes, rate-limited challenges, and audit events. Enforce MFA for privileged roles.

#### SEC-05 — Document upload controls are bypassable and unsafe for sensitive files

**Evidence:**

- Initiation checks the client-declared size at `backend/app/api/routes/cases.py:2683-2689`, but completion trusts S3 `ContentLength` and does not compare it with `s3_max_upload_bytes` at `cases.py:2751-2753`.
- `backend/app/services/storage.py:43-63` creates a presigned PUT, which does not enforce a content-length range.
- File type is client-controlled and unrestricted (`cases.py:2680-2691`); inline viewing is generated in `storage.py:78-100`.
- The user-supplied stored filename is interpolated into `Content-Disposition` without removing quotes or control characters (`storage.py:86` and `:111`).
- No antivirus/content-disarm/quarantine workflow exists.
- KMS encryption is optional when `AWS_KMS_KEY_ID` is empty (`storage.py:50-56`).

**Impact:** A user can upload oversized objects, create storage/cost pressure, and distribute malicious or active content. Sensitive immigration documents may be stored without the claimed KMS control.

**Action:** Use presigned POST conditions or a controlled multipart workflow with an enforced maximum; re-check and delete oversized objects at completion. Use an allow-list based on magic-byte detection, sanitize filenames, generate RFC 5987-safe download names, quarantine uploads, scan asynchronously, and only expose clean files. Serve active formats as attachments from a separate origin. Require KMS, bucket public-access blocking, versioning, lifecycle/retention rules, and least-privilege IAM in production.

#### SEC-06 — Public bug-report endpoint enables email and resource abuse

**Evidence:** `backend/app/api/routes/feedback.py:14-42` is unauthenticated and has no rate limit, CAPTCHA, origin enforcement, or abuse queue. `backend/app/schemas/feedback.py:19-29` allows an 8,000,000-character base64 screenshot plus 10,000 characters of text. The endpoint performs synchronous third-party email delivery and returns raw exception text.

**Impact:** Attackers can trigger large request parsing, memory use, outbound email costs, provider throttling, support spam, and internal error disclosure.

**Action:** Require authentication for in-app reports or add bot protection, per-IP/account quotas, a strict request-body limit, validated image decoding/dimensions, and asynchronous delivery. Return a generic error and log a correlation ID server-side.

#### SEC-07 — Authorized users can send arbitrary invitation emails and links

**Evidence:** `backend/app/api/routes/admin.py:641-669` permits any lawyer/admin role to supply arbitrary `to_email`, `recipient_name`, and `invitation_url`; it does not bind these values to an active invitation created by the server.

**Impact:** A compromised or malicious account can use the trusted VisaTrack sender for phishing or spam.

**Action:** Accept an invitation ID only. Resolve the recipient, organization, one-time token, and approved frontend origin server-side. Apply quotas, audit delivery, and prevent resending revoked/accepted/expired invitations.

#### DATA-01 — Alembic cannot build the documented database from scratch

**Evidence:** `backend/alembic/versions/e92b3ac1b42b_baseline.py:20-25` has empty upgrade/downgrade functions. The next migration assumes `user_profiles` already exists. `scripts/dev.sh:170` runs only `alembic upgrade head`, while `Database/setup_database.sql` independently creates the real schema and `Database/migrations/` contains a second migration system.

**Impact:** New environments can fail or drift, deployments are not reproducible, and schema changes can be applied in the wrong order.

**Action:** Select Alembic as the single source of truth. Create a real baseline for a clean PostgreSQL database, import all subsequent SQL migrations into the chain, add downgrade policy, and run “empty database → head → application smoke test” in CI. Add a schema-drift check against SQLAlchemy metadata where practical.

#### REL-01 — ZIP download can exhaust worker memory

**Evidence:** `backend/app/api/routes/cases.py:3177-3213` downloads every S3 object into memory, compresses the entire archive into another in-memory buffer, and returns another byte copy. There is no total size/document count limit. Routes are synchronous.

**Impact:** A normal large case or repeated requests can exhaust memory and block API workers.

**Action:** Stream ZIP creation, impose per-case archive limits, or build archives asynchronously in object storage and return a short-lived link. Add concurrency, cancellation, timeout, and load tests.

#### DATA-02 — Concurrent JSONB updates can lose case and document state

**Evidence:** Portal permissions, custom document suites, custom documents, upload bindings, status overrides, and rejection notes are stored together in `cases.custom_fields`. Routes repeatedly read the Python dictionary, replace keys, and write the whole value (for example `backend/app/api/routes/cases.py:2182-2187`, `:2225`, `:2305`, `:2415-2419`, and `:2844-2859`). These flows do not lock the case row or use an optimistic version check.

**Impact:** Concurrent actions such as a client completing an upload while a lawyer renames a document or changes portal permissions can overwrite each other. The result can be missing bindings, reverted permissions, or lost status/rejection data.

**Action:** Normalize workflow state into relational tables with constraints. As an interim control, lock the case row with `SELECT ... FOR UPDATE` inside a short transaction or apply atomic `jsonb_set` updates with an optimistic version/`updated_at` predicate. Return `409 Conflict` on a stale write and add concurrent update tests.

### P2

#### SEC-08 — Browser token storage and missing security headers amplify XSS impact

**Evidence:** `frontend/lib/api.ts:589-632` stores bearer tokens in `localStorage`. `frontend/next.config.ts:10-20` only sets cache headers; no CSP, HSTS, frame-ancestors, MIME sniffing, referrer, or permissions policy is configured.

**Impact:** Any frontend XSS can steal a reusable bearer token. Missing headers remove important browser defenses and invitation tokens in query strings may leak through history/referrers.

**Action:** Prefer Secure, HttpOnly, SameSite cookies with CSRF protection or use a backend-for-frontend and memory-only access tokens with rotating refresh tokens. Deploy a nonce/hash-based CSP, HSTS at the edge, `frame-ancestors`, `X-Content-Type-Options: nosniff`, strict `Referrer-Policy`, and a minimal `Permissions-Policy`.

#### SEC-09 — Legacy plaintext passwords are accepted

**Evidence:** `backend/app/core/security.py:98-99` compares any unrecognized stored value directly with the submitted password.

**Impact:** An accidentally seeded or migrated plaintext password remains a valid credential and a database read exposes it immediately.

**Action:** Remove the fallback. Perform an explicit one-time migration from known legacy formats and reject unknown hash identifiers. Use Argon2id or tuned scrypt through a maintained password library and rehash on login when parameters are obsolete.

#### SEC-10 — Authentication lifecycle needs hardening

**Evidence:** Access tokens last 60 minutes (`backend/app/core/config.py:26`); logout only clears browser state (`frontend/lib/api.ts:785-787`); password changes do not revoke tokens (`backend/app/api/routes/auth.py:304-316`). Password policy is only 8–128 characters (`backend/app/schemas/auth.py:72-79`). Email changes do not clear `email_verified` (`auth.py:224-236`). Invitation secrets are put in query strings (`backend/app/api/routes/admin.py:637` and `:878`, with similar lawyer flows), where they can enter history, referrers, proxy logs, and analytics. Login lockout is account-based with no endpoint-level/global throttling.

**Action:** Add server-side session/token revocation, rotating refresh tokens with reuse detection, shorter access tokens, password-change revocation, breached-password checks, and risk-based throttling. Redeem invitation secrets through a one-time POST or fragment-to-POST flow and never log complete invitation URLs. Normalize email with a standards-aware validator and require verification before replacing the sign-in address. Avoid account-lockout abuse by combining progressive delay, IP/device signals, and monitoring.

#### SEC-11 — Audit trails lack tamper and retention controls

**Evidence:** `Database/activity_log.sql` and `Database/document_access_log.sql` are ordinary mutable tables. The application does not record IP/user agent in `log_activity` (`backend/app/services/audit.py:11-68`), and only some document actions call `log_document_access`. No retention or export policy is present.

**Action:** Define auditable event coverage and data minimization, make records append-only for the application role, send copies to immutable centralized storage/SIEM, synchronize clocks, alert on privileged events, and test that security-sensitive actions always emit events. Define retention/legal-hold and subject-access procedures.

#### SEC-12 — Production configuration is not validated

**Evidence:** `backend/app/core/config.py:14-37` eagerly parses environment strings and silently supplies development defaults; S3/KMS/email readiness is discovered only when a feature is used. `.env.example:6` commits a real-looking AWS account and KMS key ARN rather than a placeholder. FastAPI docs remain exposed by default and trusted-host/HTTPS redirect behavior is not configured in the app.

**Action:** Use typed settings with environment-specific validation and fail fast. Validate URL schemes, secret length, token TTL, upload limits, allowed origins, KMS, and bucket names. Explicitly configure docs exposure, proxy trust, HTTPS, allowed hosts, and maximum request size for the deployment topology.

#### REL-02 — Case number generation races

**Evidence:** `backend/app/api/routes/cases.py:228-251` computes `MAX(existing)+1`, then `cases.py:701-742` inserts later without locking or conflict retry.

**Impact:** Concurrent case creation can collide and return a 500 even though the database unique constraint protects integrity.

**Action:** Use a per-organization/year sequence/counter updated atomically, or retry boundedly on unique violation. Add a concurrency test.

#### REL-03 — Deleting document records leaves S3 objects orphaned

**Evidence:** Case document routes soft-delete database rows, but no backend code calls S3 `delete_object`.

**Impact:** Costs and sensitive data persist beyond the user-visible deletion lifecycle, complicating privacy deletion and retention commitments.

**Action:** Define soft-delete retention, legal hold, restoration, and purge semantics. Queue idempotent object deletion after the database transaction, record proof, and use bucket lifecycle rules as a backstop.

#### REL-04 — Health checks do not prove readiness

**Evidence:** `backend/app/api/routes/health.py:7-14` always returns `{"status":"ok"}` without checking the database or required dependencies.

**Action:** Separate liveness from readiness. Readiness should perform bounded checks for database connectivity and critical configuration; report degraded optional providers without exposing secrets.

#### REL-05 — Error handling and observability are insufficient

**Evidence:** There is no global exception mapping, request ID, structured request logging, tracing, metrics, or error-monitoring integration under `backend/app`. Several routes return third-party exception strings. The frontend request helpers have no timeout/abort behavior (`frontend/lib/api.ts:682-768`).

**Action:** Add structured redacted logs, correlation IDs, centralized exception handling, latency/error metrics, traces for DB/S3/email, alerting, and runbooks. Add frontend request cancellation/timeouts and distinguish retryable errors from validation/auth failures.

#### REL-06 — Database pooling and transactions are not production-tuned

**Evidence:** `backend/app/db/session.py:10-12` uses default engine pool settings; route handlers manually commit and mix ORM with large blocks of raw SQL. `backend/app/db/deps.py:10-15` closes sessions but does not explicitly roll back when a request fails.

**Action:** Set pool size/overflow/recycle/connect and statement timeouts from validated configuration. Standardize transaction boundaries, always roll back failed units of work, map integrity/deadlock failures, and document isolation expectations. Review indexes with real query plans.

#### REL-07 — ORM, SQL schema, and status metrics have drifted

**Evidence:** `Database/cases.sql:18-30` defines IRCC identifiers and timeline columns that are absent from `backend/app/models/case.py:18-53`, while raw workspace SQL still selects `start_date`. The API canonicalizes statuses to `intake`, `awaiting_client`, `in_progress`, and `closed` (`backend/app/api/routes/cases.py:89-94`), but admin/dashboard metrics and a database index still use legacy terminal values such as `approved`, `refused`, and `withdrawn`.

**Impact:** Alembic autogeneration cannot represent the deployed schema, ORM-only changes can be destructive, and active/completed dashboard counts can be wrong after status consolidation.

**Action:** Reconcile every model and schema column as part of migration consolidation. Put case status in one shared domain definition used by API validation, SQL constraints, indexes, filters, and metrics; backfill legacy values and add metric contract tests.

#### REL-08 — Authentication writes have concurrency races

**Evidence:** Login reads and increments `login_attempts` without a row lock or atomic update (`backend/app/api/routes/auth.py:99-119`). Invitation acceptance checks `accepted_at IS NULL` and updates later without locking the invitation (`auth.py:364-403`).

**Impact:** Parallel login failures can under-count attempts and delay lockout. Concurrent invitation submissions can both pass the one-time check and perform duplicate/inconsistent setup work.

**Action:** Use atomic `UPDATE ... RETURNING` or lock the relevant row for login counters. Lock and conditionally update invitation acceptance in one transaction, with database uniqueness/idempotency constraints and concurrency tests.

#### QUAL-01 — Tests are mostly mocked units, with no enforced coverage or end-to-end suite

**Evidence:** The backend has roughly 105 test functions, but fixtures use `SimpleNamespace`, `MagicMock`, and fake results (`backend/tests/conftest.py`, `backend/tests/support.py`). The frontend has eight explicit tests under `frontend/tests` plus a story-render runner. CI runs tests but no coverage threshold, real PostgreSQL integration, browser E2E, migration bootstrap, accessibility gate, or S3-compatible integration test. Meeting notes claim 80%+ E2E/coverage, but no reproducible report or E2E configuration exists.

**Action:** Build a test pyramid: unit tests, PostgreSQL/Testcontainers integration tests, auth/tenant negative tests, API contract tests, and Playwright user journeys. Enforce coverage on security-critical modules and publish reports. Add axe/WCAG checks and avoid presenting story rendering as visual regression unless screenshots are compared.

#### QUAL-04 — Storybook CI builds the wrong, empty story tree

**Evidence:** `frontend/.storybook/main.ts:4` searches `../figma/**/*.stories.@(ts|tsx)`, but the repository's stories are under `frontend/design-system`. CI runs `npm run build-storybook`, so the catalog build can succeed without exercising the actual stories. The separate Vitest story test uses a different discovery path.

**Impact:** The Storybook and accessibility-addon CI signal is falsely green for production components.

**Action:** Point Storybook and story tests at one shared `design-system/**/*.stories` pattern, fail CI when zero stories are discovered, and add accessibility assertions for critical states.

#### A11Y-01 — Core forms and dialogs do not meet keyboard/screen-reader requirements

**Evidence:** `frontend/design-system/components/admin-dashboard/ConfirmDialog.tsx:15-54` implements a modal as generic `div` elements without dialog semantics, accessible naming, focus containment/restoration, initial focus, or Escape handling. Its overlay also uses nonstandard `z-80`, while arbitrary Tailwind values elsewhere use bracket syntax. Login labels in `frontend/design-system/components/PortalAuthGate.tsx:99-130` have no `htmlFor` or matching input IDs. Similar overlay/label patterns recur across the design system.

**Impact:** Keyboard and assistive-technology users may be unable to identify, navigate, dismiss, or safely operate destructive dialogs and authentication forms. Stacking errors can also place confirmation UI beneath another overlay.

**Action:** Build or adopt a tested dialog primitive with `role="dialog"`, `aria-modal`, labelled title/description, focus trap/restoration, Escape, and deterministic stacking. Associate every label and input, add a skip link and main landmarks, respect reduced motion, and run automated axe plus manual keyboard/screen-reader checks against WCAG 2.2 AA.

#### QUAL-02 — Request schemas are inconsistently bounded

**Evidence:** Several case request models in `backend/app/schemas/case.py:22-32` and `:166-290` use unconstrained strings/text, unlike more carefully bounded admin schemas.

**Impact:** Oversized content can reach memory, logs, the database, email, and UI; malformed enum-like values are handled repeatedly in routes.

**Action:** Centralize constrained domain types and enums, set global body limits, validate dates and cross-field invariants, and use `EmailStr`/URL types where appropriate. Keep database constraints aligned.

#### QUAL-03 — Python builds are not reproducible

**Evidence:** `backend/requirements.txt` uses broad ranges and no lock/hashes. CI upgrades pip and resolves dependencies afresh on every run. A clean audit verification on 2026-09-11 resolved current packages and produced 101 passing tests plus one failure in `tests/api/test_router.py`: the test assumes every `api_router.routes` entry has `.path`, but the resolved FastAPI version exposes an `_IncludedRouter` entry.

**Action:** Generate a reviewed lock with hashes for runtime and development dependencies, automate updates, scan both the lock and container/image, and record supported Python/PostgreSQL versions.

#### OPS-01 — Security workflows are configured but currently inactive

**Evidence:** Repository workflow state inspected on 2026-09-11 showed CodeQL and SBOM as `disabled_inactivity`; the latest listed CodeQL run was 2026-06-29. Build/Test and Dependabot Updates were active. Actions are referenced by mutable major tags rather than commit SHAs.

**Action:** Re-enable CodeQL and SBOM before releases, make security results visible to maintainers, add secret scanning and dependency/license/container/IaC scans, pin third-party actions to reviewed commit SHAs, minimize workflow permissions, and add artifact provenance/signing.

#### OPS-02 — Deployment, backup, and recovery controls are not represented

**Evidence:** No Dockerfile, infrastructure-as-code, deployment manifest, backup configuration, or disaster-recovery test is present in the repository. The root `docker-compose.yml` is empty.

**Action:** Add a hardened non-root image and IaC, or clearly link the private operational source of truth. Document TLS termination, network boundaries, secrets, IAM, database encryption/backups/PITR, restore tests, multi-AZ expectations, S3 versioning, RPO/RTO, rollback, and incident response.

#### OPS-03 — Repository manifests and documentation contain conflicting sources of truth

**Evidence:** The root `package-lock.json` describes an empty npm project but there is no root `package.json`. `backend/app/requirements.txt` duplicates the main requirements with a different dependency set. The root README claims an MIT license, but no `LICENSE` file exists. Several frontend/docs READMEs describe files that are absent or moved. `.vscode/settings.json:10-11` commits a developer-specific database username.

**Impact:** Dependency scanners and IDEs can target the wrong manifest, developers receive inconsistent setup instructions, and distribution rights are ambiguous without the actual license text.

**Action:** Remove the orphan lockfile or define a real workspace root; keep one generated/locked Python dependency source; add the intended license after owner approval; validate documentation links in CI; and replace personal editor/database settings with sanitized examples.

#### PERF-01 — Frontend caching and rendering choices increase latency

**Evidence:** `frontend/next.config.ts:10-20` applies `no-store` to every route, potentially including immutable assets. `frontend/app/page.tsx:9-18` disables SSR for the entire application shell.

**Action:** Apply `no-store` only to authenticated sensitive responses and allow fingerprinted static assets to use long immutable caching. Measure whether full client-only rendering is required; server-render the public/auth shell where safe. Add bundle budgets and Lighthouse checks.

#### UX-01 — Product metadata remains boilerplate

**Evidence:** `frontend/app/layout.tsx:23-26` uses “Create Next App” metadata.

**Action:** Add VisaTrack title/description, icons, manifest, canonical/robots policy, accessible error/loading states, and privacy/support links. Test keyboard/focus behavior and target WCAG 2.2 AA.

### P3 enhancements

1. **Privacy operations:** create a data inventory and classification model; map lawful purpose/consent, residency, subprocessors, retention, export, correction, deletion, breach response, and legal holds. Obtain counsel for applicable Canadian federal/provincial privacy and law-society obligations.
2. **Fine-grained authorization:** centralize policy decisions (subject, tenant, case relationship, action, resource state) instead of repeated role branches. Add a deny-by-default authorization matrix and property-based tenant-isolation tests.
3. **Client-safe DTOs:** make internal and portal representations different types throughout the API so newly added internal fields cannot accidentally serialize to clients.
4. **Async jobs:** move email, malware scanning, bulk archives, reminders, and other slow/retryable work to an idempotent queue with a dead-letter policy.
5. **API lifecycle:** publish OpenAPI-derived clients, version/deprecation rules, idempotency keys for write endpoints, consistent pagination envelopes, and optimistic concurrency for edits.
6. **Operational maturity:** define SLOs for API availability/latency and email/document workflows, synthetic checks, dashboards, on-call ownership, incident exercises, and capacity/load tests.
7. **Accessibility and localization:** automate axe checks, perform manual screen-reader/keyboard audits, respect reduced motion, and validate locale/time-zone/date/currency handling.
8. **Architecture:** split the very large `cases.py` route module into policy, query, command, document, billing, and serialization services with explicit transaction boundaries.
9. **Frontend request lifecycle:** add `AbortController` cancellation and backoff to polling/fetch flows so unmounted or stale requests cannot overwrite newer state; pause refresh while forms contain unsaved edits.
10. **Safer external windows:** avoid `window.open` for sensitive document URLs where possible; when required, enforce `noopener` and clear `window.opener`.

## Recommended remediation order

### Release stop: P0

1. Rotate and enforce JWT configuration; invalidate all sessions.
2. Upgrade Next.js and clear all critical/high production dependency findings.
3. Remove `internal_notes` from every client response and add regression tests.

### Security baseline: P1

1. Make database account state and active-role permissions authoritative.
2. Disable the MFA toggle until real MFA is enforced.
3. Quarantine, bound, validate, scan, and encrypt document uploads.
4. Protect feedback/email endpoints against abuse.
5. Consolidate the database migration path.
6. Replace in-memory bulk archive generation.

### Hardening: P2

Add secure browser/session controls, remove plaintext password compatibility, implement token revocation, secure headers, immutable audit export, typed configuration, readiness/observability, integration/E2E tests, locked dependencies, and active security CI.

## Definition of done for production

- All P0 and P1 findings are closed with negative regression tests.
- A clean environment can be built deterministically from source and migrated from an empty database.
- Threat modeling covers tenant boundaries, privileged roles, invitations, documents, email abuse, and financial records.
- Independent penetration testing includes authorization/IDOR, tenant isolation, upload handling, session lifecycle, and business-logic abuse.
- AWS/IAM/S3/KMS, deployment, TLS, database, backup/restore, logging, and alerting are reviewed in the real production environment.
- Privacy/security policies have named owners, retention schedules, incident procedures, and evidence of restore and incident exercises.
- Required CI includes build, lint/typecheck, unit/integration/E2E, migration bootstrap, dependency/secret/SAST scans, SBOM, and reviewed release artifacts.

## Standards and references to apply

- OWASP ASVS 5.0 and OWASP API Security Top 10
- OWASP File Upload, Session Management, Authentication, and Logging cheat sheets
- NIST SSDF (SP 800-218) and NIST Digital Identity Guidelines (SP 800-63B)
- CIS Software Supply Chain and relevant cloud/database benchmarks
- SLSA provenance practices and SPDX/CycloneDX SBOMs
- WCAG 2.2 AA
- Privacy-by-design and applicable Canadian privacy/law-society requirements, validated by qualified counsel

## Existing controls worth preserving

- Most resource queries include organization and relationship scoping.
- Raw SQL reviewed in the application uses bound parameters; no direct SQL string interpolation was found.
- Scrypt/PBKDF2 hashes use unique random salts and constant-time comparison for recognized formats.
- Invitation tokens use strong randomness and are stored as SHA-256 hashes.
- S3 URLs are short-lived and object keys include organization/case/document scope.
- Trust-account SQL includes cross-organization consistency checks and immutable financial fields.
- CI builds both applications and runs backend/frontend tests.
- Dependabot, CodeQL, SBOM, CODEOWNERS, a security disclosure policy, and contribution guidance exist, though several controls need enforcement or reactivation.

## Audit verification results

- `git diff --check`: passed.
- Frontend install: completed, with npm reporting 31 known vulnerabilities (two critical, 15 high, 12 moderate, two low).
- Frontend lint: passed with four warnings (two unused variables and two unoptimized image warnings).
- Frontend tests: 59 passed across four files.
- Frontend production build: passed.
- Backend tests: 101 passed and one failed in `tests/api/test_router.py`; PyJWT also emitted two warnings that the configured 18-byte HMAC test/default key is below the 32-byte RFC 7518 recommendation.
- Python vulnerability resolution was not treated as authoritative because runtime dependencies are ranges rather than a committed lock. Generate the lock first, then scan that exact artifact in CI.
