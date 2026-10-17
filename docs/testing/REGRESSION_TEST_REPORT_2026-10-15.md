# VisaTrack regression test report — October 15, 2026

Automated local regression testing completed with **16 of 18 live scenarios
passing and two confirmed permission defects**. The existing frontend component,
mocked browser, and backend suites also passed. This is targeted regression
coverage; it does not establish that every feature or integration works.

## Build and environment

- Application revision: `3d66083f534613bbbc1cbef5cd68a7124937739f` on `develop`.
- New test code and this report: branch `test/regression-testing`.
- Environment: local Mac Docker application, frontend `http://localhost:3000`,
  backend `http://localhost:8000`, PostgreSQL in the Compose network.
- Live runner: Node 22.12, Playwright 1.63, Alpine Chromium 136.0.7103.113;
  desktop and 390 × 844 mobile viewport checks.
- Final live run: 18 scenarios, one worker, no retries; 16 passed, two failed,
  no skips or flaky results; approximately 23 seconds.
- Application behavior was not changed. Repository changes are test tooling,
  test configuration, documentation, and generated-report ignore rules.

## Verification results

| Check | Result | Scope |
| --- | --- | --- |
| Existing frontend Vitest suite | Pass: 23 files, 253 ordinary passes plus one documented expected failure | Components, utilities, and Storybook rendering; mocked API responses. |
| Existing Playwright suite | Pass: 12 scenarios | Real Chromium interactions with mocked backend responses. |
| Existing backend pytest suite | Pass: 250 tests | Existing image's API/service/core/worker tests with mocks and an isolated, unused database URL. |
| New live regression suite | 16 passed, two failed | Real local frontend, API, database persistence, role and tenant restrictions; no request interception. |
| Frontend TypeScript | Pass | Includes the new configuration and tests. |
| Targeted ESLint | Pass | New regression configuration, fixtures, scenarios, and Docker runner. |
| Docker runner build and execution | Pass | The documented image builds and runs; the suite correctly exits with code 1 for the two defects. |

The component suite's expected failure is **CT-CASECFG-07**: a saved case status
missing from the dropdown can display as Intake. Its expected-failure handling
keeps that existing suite green while the known defect remains.

## Live scenario results

The suite contains 15 scenarios with browser interactions and three API-only
authorization/permission scenarios. Fixtures use real APIs to provision uniquely
named synthetic organizations and separate role accounts. API assertions also
check persistence and information visibility after browser actions.

| ID | Result | Behavior checked |
| --- | --- | --- |
| REG-AUTH-01 | Pass | Invalid password, valid login, reload with session, logout, reload while signed out. |
| REG-ROLE-01 | Pass | Organization-admin dashboard and actual member list. |
| REG-CASE-01 | Pass | Browser case creation, persistence after reload, and visibility to its client. |
| REG-CASE-02 | Pass | Case search, status filtering, no-match result, filter reset. |
| REG-DETAILS-01 | Pass | Case details persist; internal notes do not appear in the client API response. |
| REG-MILESTONE-01 | Pass | Create milestone, hide it from the client, delete it. |
| REG-REMINDER-01 | Pass | Lawyer posts reminder; client opens it; read timestamp persists. |
| REG-DOCUMENT-01 | Pass | Create custom suite and document request; rename and delete the request. |
| REG-PERMISSION-01 | Pass | Disabling a portal persists and restricts its client workspace response. |
| REG-PROFILE-01 | Pass | Profile phone change survives reload. |
| REG-INVOICE-01 | Pass | Create invoice with CAD 100 fees + 13% tax; client balance is CAD 113 with no payment recorded. |
| REG-INVITE-01 | Pass | Activate invited client through the invitation page and log in. |
| REG-ACCESS-01 | Pass | Client cannot use lawyer/admin APIs or access unrelated or other-organization cases. |
| REG-READONLY-01 | Fail | Read-only portal should retain enabled, client-visible milestones. |
| REG-READONLY-02 | Fail | Read-only portal should reject client reminder responses. |
| REG-MFA-01 | Pass | Enroll a disposable account through real APIs; browser rejects invalid MFA and accepts a real authenticator code. |
| REG-PUBLIC-01 | Pass | Cookie choice persists; privacy, refund, and deletion pages load. |
| REG-MOBILE-01 | Pass | Signed-in mobile navigation opens Cases and closes the drawer. |

## Confirmed defects

### REG-READONLY-01 — enabled milestones disappear in read-only mode

1. Create a case and a client-visible milestone as its lawyer.
2. Keep milestone visibility enabled, but change Client Portal Access to Read Only.
3. Retrieve the case workspace as its client.

Expected: the milestone remains visible. The option promises that clients can
view enabled information while uploads and responses are prevented.

Actual: the client workspace contains an empty `milestones` array. The backend
allows milestone visibility only for `full_access`, while case status and billing
also allow `read_only`.

Relevant implementation: `backend/app/api/routes/cases.py`,
`client_can_view_milestones` inside the workspace route. The user-facing contract
is in `frontend/design-system/components/case-configuration/sections/PermissionsSection.tsx`.

### REG-READONLY-02 — read-only mode accepts reminder acknowledgements

1. Create a case reminder as its lawyer.
2. Set the portal to Read Only with reminder visibility enabled.
3. As its client, POST to
   `/api/v1/cases/by-number/{case}/reminders/{reminder}/acknowledge`.

Expected: HTTP 403; a read-only client cannot respond.

Actual: HTTP 200, accepting the acknowledgement. The route checks reminder
visibility without enforcing the read-only restriction. The current client UI
has no acknowledgement button, so this is an API permission defect.

Relevant implementation: `acknowledge_case_reminder` and
`_client_portal_capabilities` in `backend/app/api/routes/cases.py`.

Both scenarios remain ordinary failing tests. They have not been skipped or
converted into expected failures. These findings establish defects against the
current UI contract, not which historical commit introduced them.

## Blocked and uncovered workflows

| Workflow | Status and reason |
| --- | --- |
| Actual document upload, scanning, viewing, download, archive, and file deletion | Blocked: MinIO and the document worker are not running. Compose also uses the Docker-only browser URL `http://minio:9000` and does not publish its storage port or configure the frontend storage origin. Request management passing does not prove file transfers. |
| Completed Stripe payment, webhook reconciliation, failure/refund flows | Blocked: Stripe secret and webhook secret are not configured. Invoice creation was checked without completing checkout. |
| Invitation, reminder, or invoice email delivery | Blocked: email provider key is not configured. Invitation activation used its returned link without sending email. |
| AI provider connections, case chat, indexing, form generation | Not exercised: AI is disabled and providers are not configured. |
| Every admin operation, MFA recovery/disable, all error branches and feature combinations | Outside these 18 scenarios. Existing mocked suites cover additional branches, but they do not prove live behavior. |
| Full visual, usability, accessibility, Safari/Firefox, and physical-device review | Outside this run. Chromium interactions and the existing accessibility checks are not a complete manual review. |

## Test data and evidence

Only synthetic local organizations, users, cases, reminders, invoices, and document
request metadata were used. The existing `ronit-regression` organization and its
manual login accounts were retained. Temporary `autoreg-*` organizations are
soft-deleted at teardown; their rows and audit history remain in the local
database. API sessions are logged out. No messages were sent and no payments
were made.

Raw evidence is local and is not committed because traces can contain synthetic
account and authentication data:

- Final live HTML report: `frontend/regression-results/report/index.html`.
- Final live JSON: `frontend/regression-results/results.json`.
- Live failure traces: `frontend/regression-results/test-results/`.
- Existing frontend evidence: `frontend/regression-results/existing/`.
- Backend log, JUnit XML, and exact command: `frontend/regression-results/backend/`.

See [the live regression guide](../../frontend/regression/README.md) for the
repeatable Docker/native commands, runtime credentials, scenario IDs, and cleanup
behavior. The `frontend/regression-results` directory is excluded from Git.
Reruns generate fresh evidence, so archive this directory separately when
preserving a particular execution record.
