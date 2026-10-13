# Frontend UI testing with Playwright

These browser tests follow the same actions as a manual tester: enter credentials,
click navigation, search cases, change filters, and fill or dismiss a dialog.
Named `test.step` blocks make each scenario readable in UI Mode and the HTML report.
Playwright was already used for accessibility checks; this extends that suite without
adding a second framework or changing application behavior.

## First run

From the repository root, with the project's supported Node.js version installed:

```powershell
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e:ui
```

On Windows, use `npm.cmd` / `npx.cmd` if PowerShell blocks `.ps1` scripts.
On Linux, install browser OS dependencies with `npx playwright install --with-deps chromium`.

The runner starts the checked-out frontend automatically at `http://127.0.0.1:3100`.
Port 3100 keeps it separate from the Docker app on port 3000. No backend, `.env`, database,
bootstrap account, email service, or cloud credentials are needed for this suite.
An existing server on port 3100 is reused locally; stop it if it serves another checkout.

## Choose how to run

Run these commands inside `frontend`:

| Command | Purpose |
| --- | --- |
| `npm run test:e2e:ui` | Interactive test explorer; select a scenario, run it, inspect its steps and DOM snapshots, or enable watch mode. |
| `npm run test:e2e:headed` | Watch the automated actions in Chromium, one test at a time. This is not a manual pause between steps. |
| `npm run test:e2e:debug -- --grep AUTH-03` | Open the Inspector for a single scenario; pause and step through actions. |
| `npm run test:e2e` | Run the full suite headlessly. |
| `npm run test:e2e -- --grep CASE-01` | Run one scenario by its stable ID. |
| `npm run test:e2e:report` | Open the latest HTML report after a run. |

For slower machines, append `-- --workers=1` to `npm run test:e2e`.
The HTML report is written to `playwright-report/`. Failed tests retain a screenshot
and trace under `test-results/`; both directories are ignored by Git. Open the trace
from the report to inspect actions, network requests, and the page at failure time.

To deliberately test an already-running frontend instead of starting one:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3000'
npm run test:e2e
Remove-Item Env:E2E_BASE_URL
```

For bash: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`.
That server must already be started (and rebuilt after source changes when using Docker).
API responses remain mocked even when using this option.

## Coverage and manual review checklist

Each row maps to an automated scenario. In UI Mode, expand the named steps and compare
the before/after page snapshots. To repeat the steps yourself against a real local
deployment, use a dedicated **lawyer** account and synthetic cases; the fixture credentials
only work inside intercepted Playwright tests. Do not use the local super-admin account
for the lawyer workflow checks.

| ID | Actions | Expected result |
| --- | --- | --- |
| AUTH-01 | Submit the empty sign-in form. | Organization field is focused by browser validation; no login request. |
| AUTH-02 | Enter an incorrect password, then correct it. | Visible error; form stays usable; successful correction opens the lawyer dashboard. |
| AUTH-03 | Sign in, reload, sign out, reload again. | Session is restored before logout; sign-in screen remains after logout. |
| AUTH-04 | Sign in with MFA required; try an invalid code, then a valid one. | Challenge appears; invalid code is rejected; valid code opens the dashboard. |
| CASE-01 | Open Cases; search by client, combine with status, clear filters, search by ID/type, go back. | Only matching rows remain; no-match message appears; resetting restores the list and navigation works. |
| CASE-02 | Fail the case-list request, then restore it and click Retry. | Error is visible; Retry loads rows and clears the error. |
| CASE-03 | Open New Case; submit empty client details; edit fields; cancel; reopen; press Escape. | Validation blocks submission; no writes; abandoned fields reset; Escape closes and returns focus to New Case. |
| CASE-04 | Submit completed new-client details while the service fails. | Error remains in the dialog; entered details are preserved; submission becomes available again. |
| NAV-01 | At 390 x 844, open navigation and select Cases. | Cases opens and the mobile drawer closes. |
| Existing accessibility checks | Use skip link and inspect sign-in with axe. | Main receives keyboard focus; no serious/critical violations for the configured WCAG tags. |
| Existing compliance check | Choose essential cookies; visit privacy/refund/deletion pages. | Consent banner dismisses; required content and accessible deletion confirmation are present. |

For a live manual pass, prepare three synthetic cases with different clients/types and
statuses (`in_progress`, `intake`, `closed`). Use browser DevTools request blocking to
exercise CASE-02, then unblock before Retry. To reproduce CASE-04 without creating a
client, block the client-creation request before submitting and unblock afterward.
Use a disposable MFA-enrolled test account for AUTH-04; its real authenticator code
replaces the mocked code. Record any scenario that cannot be reproduced as **Blocked**,
not Passed.

Record a manual review using this template:

```text
Commit / branch:
Tester / date:
Browser / viewport:
Environment (mocked UI Mode or local full stack):
Scenario ID:
Result: Pass / Fail / Blocked
Actual result and reproduction steps:
Screenshot or trace / issue link:
```

## Isolation and limits

`fixtures.ts` intercepts `/api/v1/` requests before navigation, supplies synthetic users
and cases, and resets session/error state for every test. Unexpected API endpoints fail
the test instead of silently reaching the backend. Existing public-page tests use the
same fixture so session checks do not depend on a running API.

This validates frontend rendering, interaction, validation, request payloads, and error
handling. It does **not** prove real password/MFA verification, authorization enforcement,
refresh-cookie security, database persistence, successful case creation, document scanning,
payment processing, or email delivery. Client/admin workflows and Firefox/WebKit are not
covered by these new scenarios. Full-stack checks and exploratory visual review remain
separate; axe is also not a complete accessibility audit.

## CI and maintenance

Local verification on October 13, 2026 (Windows, Chromium): all 12 scenarios passed
against both the development server and production build (`CI=1`). The frontend build,
TypeScript check, and ESLint check for `e2e` and `playwright.config.ts` also passed.

The existing `Build & Test` workflow builds the frontend and runs all browser scenarios
against the production build on port 3100. CI uses two workers and retries failures twice.
It uploads `frontend-playwright-report` (report, failure screenshots, and traces) for
14 days even if tests fail. A passing local run does not claim that a remote CI run passed.

Add tests to the appropriate `.spec.ts`, import `test` and `expect` from `./fixtures`,
and add explicit endpoint responses to the fixture when needed. Use accessible roles
and labels, awaited assertions, and named steps. Avoid fixed sleeps, shared accounts,
real secrets, and broad mocks that return success for every URL. Update this coverage
table when adding or changing scenarios.

References: [Playwright UI Mode](https://playwright.dev/docs/test-ui-mode),
[API mocking](https://playwright.dev/docs/mock).
