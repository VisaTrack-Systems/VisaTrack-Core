# Live regression tests

This suite drives Chromium against the running local VisaTrack frontend, backend,
and database. It checks real API responses and persisted data. It uses no browser
or request mocks. The component suite (`npm test`) and existing browser suite
(`npm run test:e2e`) use mocked API responses and serve a different purpose.

## Before running

Start Docker Desktop and the local application, using the same setup and database
migrations as your normal development environment. From the repository root:

```bash
docker compose up -d --wait postgres
docker compose up -d --wait --no-deps backend frontend
```

The frontend must be available at `http://localhost:3000` and the backend at
`http://localhost:8000`. Rebuild the application after application changes; this
test image does not build or start the website.

You need an existing local **super-admin** account. By default the suite uses
organization slug `ronit-regression` and email `superadmin@regression.test`.
These are identifiers, not an account-creation mechanism. The password must be
provided at runtime. To use a different bootstrap account, also export
`REGRESSION_BOOTSTRAP_SLUG` and `REGRESSION_BOOTSTRAP_EMAIL` and pass them to Docker
with `-e REGRESSION_BOOTSTRAP_SLUG -e REGRESSION_BOOTSTRAP_EMAIL`.

Enter the password without placing it in shell history; these commands work in
the Mac's default zsh terminal:

```bash
printf 'Local super-admin password: '
read -r -s REGRESSION_BOOTSTRAP_PASSWORD
printf '\n'
export REGRESSION_BOOTSTRAP_PASSWORD
```

## Run with Docker on a Mac

No Node.js installation is needed on the Mac. From the repository root:

```bash
docker build -f frontend/regression/Dockerfile -t visatrack-regression frontend
mkdir -p frontend/regression-results
docker run --rm --shm-size=1g \
  -e REGRESSION_ALLOW_MUTATIONS=local \
  -e REGRESSION_BOOTSTRAP_PASSWORD \
  --mount type=bind,source="$PWD/frontend/regression-results",target=/evidence \
  visatrack-regression
```

The trailing `\` joins the lines into one command. Run the same `docker run`
command again for another pass. Rebuild the test image after changing tests or
their dependencies. The runner forwards real HTTP traffic from the container's
localhost ports 3000 and 8000 to the Mac through `host.docker.internal`. This
preserves the API URL in the compiled frontend and the backend's trusted Origin.
It does not publish extra host ports or replace API responses.

Playwright arguments can be appended after the image name. For example, to run
only the case scenarios, append `--grep REG-CASE`. The Docker runner is headless;
use the native command below for a visible browser.

Results are saved under `frontend/regression-results`:

- `results.json`: machine-readable outcomes.
- `report/index.html`: HTML report.
- `test-results/`: screenshots and traces for failures.

The environment variables `REGRESSION_OUTPUT_DIR`, `REGRESSION_REPORT_DIR`, and
`REGRESSION_JSON_REPORT` can override these container paths; keep them beneath
the mounted `/evidence` directory to retain the files after the container exits.

To view the HTML report without installing Node, run this from the repository
root and leave its terminal open:

```bash
docker run --rm -p 127.0.0.1:9323:9323 \
  --mount type=bind,source="$PWD/frontend/regression-results",target=/evidence,readonly \
  --entrypoint node visatrack-regression \
  node_modules/@playwright/test/cli.js show-report /evidence/report \
  --host 0.0.0.0 --port 9323
```

Open `http://localhost:9323` in your browser. Press Ctrl+C in that terminal to
stop the report viewer; this does not stop VisaTrack.

## Run natively with Node.js

Use the supported Node.js version (22.12 or later) and supply the password as
above. From the repository root:

```bash
cd frontend
npm ci
npx playwright install chromium
REGRESSION_ALLOW_MUTATIONS=local npm run test:regression
```

For a visible browser, append `-- --headed`. To run one scenario, append
`-- --grep REG-AUTH-01`. On Linux, use
`npx playwright install --with-deps chromium` when installing the browser.

Native outputs default to `frontend/regression-report` and
`frontend/regression-results`. To open either native or Docker HTML results with
Node.js installed, run `npx playwright show-report PATH_TO_REPORT` from
`frontend`, replacing `PATH_TO_REPORT` with `regression-report` or
`regression-results/report` respectively.

After testing, remove the password from the shell environment:

```bash
unset REGRESSION_BOOTSTRAP_PASSWORD
```

## Test data and cleanup

`REGRESSION_ALLOW_MUTATIONS=local` explicitly enables creation and modification
of local synthetic data. The fixtures restrict the target to local development
URLs. Each run creates two uniquely named `autoreg-*` organizations, role-specific
users, and synthetic cases. The bootstrap account is used to provision the test
organizations; feature checks use the appropriate role accounts.

Teardown soft-deletes those temporary organizations through the real API and
logs out the API sessions. Soft deletion is not physical database erasure: test
rows remain in the local database. If a process is forcibly terminated, cleanup
may not finish; its `autoreg-*` organizations can be retired using the local
super-admin tools. The existing bootstrap organization and accounts are kept.

Reports, screenshots, and traces can include synthetic user information, case
content, and authentication requests. Keep the evidence local and avoid
committing raw trace files or passwords.

## Coverage

| ID | Real behavior checked |
| --- | --- |
| REG-AUTH-01 | Invalid password, successful login, session reload, logout, and reload after logout. |
| REG-ROLE-01 | Organization administrator dashboard and organization member list. |
| REG-CASE-01 | Browser case creation, persistence after reload, and visibility to its client. |
| REG-CASE-02 | Search and status filters against persisted cases, including no matching rows. |
| REG-DETAILS-01 | Case details persist; internal notes are excluded from the client response. |
| REG-MILESTONE-01 | Milestone creation, client visibility toggle, and deletion. |
| REG-REMINDER-01 | Lawyer creates a reminder; client opens it and its read state persists. |
| REG-DOCUMENT-01 | Custom document suite and request creation, rename, and deletion. |
| REG-PERMISSION-01 | Portal disabling persists and restricts the client workspace response. |
| REG-PROFILE-01 | Profile phone change survives reload. |
| REG-INVOICE-01 | Invoice creation and correct total and balance in the client workspace. |
| REG-INVITE-01 | Invitation activation through the real page, followed by login. |
| REG-ACCESS-01 | Client role restrictions and denial of unrelated and other-organization cases. |
| REG-READONLY-01 | Read-only portal retains client-visible milestones. |
| REG-READONLY-02 | Read-only portal refuses client reminder responses. |
| REG-MFA-01 | Real MFA enrollment, invalid-code rejection, and valid-code login. |
| REG-PUBLIC-01 | Cookie preference persistence and public legal pages. |
| REG-MOBILE-01 | Signed-in mobile navigation opens Cases and closes its drawer. |

## Scope and service blockers

This is a focused regression suite, not every possible feature combination or a
complete visual/accessibility review. It uses Chromium only. The scenarios
themselves provide the expected behavior; a failure requires investigation and
does not automatically identify an application defect rather than a test issue.

Document request management is covered, but real file upload, scanning,
download, and deletion need configured storage and document workers. Completing
Stripe checkout needs Stripe test configuration and working webhooks. Invitation
activation uses the API-provided invitation link and does not verify email
delivery. AI/provider workflows need their own configured services and checks.
Record unavailable service workflows as **Blocked**, not Passed. Invoice creation
alone does not establish successful payment or delivery of an invoice email.
