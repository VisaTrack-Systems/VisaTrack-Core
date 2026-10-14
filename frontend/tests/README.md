# frontend/tests

For browser workflows, interactive Playwright runs, and the manual review checklist,
see [Frontend UI testing](../e2e/README.md). This directory contains the separate
Vitest/component suite.

This directory contains the frontend test suite for VisaTrack, organized to test UI components, integration scenarios, and utilities. Tests use Vitest (Vite's native test runner) and React Testing Library for component testing, with Storybook integration for visual regression and component snapshot testing.

## Overview

- **[clientDashboard.permissions.test.tsx](clientDashboard.permissions.test.tsx)** - Tests for client dashboard access control and permission-based rendering
- **[storybook.test.tsx](storybook.test.tsx)** - Automated Storybook story rendering tests (verifies all story variants render without errors)
- **[permissionsSection.test.tsx](permissionsSection.test.tsx)** - Tests for role-based permission rendering and UI visibility
- **[relativeTime.test.ts](relativeTime.test.ts)** - Utility function tests for relative time formatting (e.g., "2 hours ago")

### Component scenarios (CT-*)

These tests render each screen with `@/lib/api` mocked, so no backend, database, or credentials are needed.
Every test name starts with a stable scenario ID, in the same style as the Playwright IDs in
[e2e/README.md](../e2e/README.md). `CT-` (component test) keeps the two sets of IDs apart.

| Command (run inside `frontend`) | Purpose |
| --- | --- |
| `npm test` | Run every Vitest test, including these scenarios. |
| `npx vitest run -t "CT-CLIENT"` | Run every scenario for one screen. |
| `npx vitest run -t "CT-CASECFG-27"` | Run one scenario by its ID. |
| `npx vitest -t "CT-ADMIN"` | Watch mode: rerun a screen's scenarios on every save. |

#### Coverage

| IDs | File | What is checked |
| --- | --- | --- |
| CT-AUTH-01 to 08 | [portalAuthGate.test.tsx](portalAuthGate.test.tsx) | Session loading, wrong-role block and sign out, trimmed sign-in request, button state while signing in, error shown, MFA code requested and sent on retry. |
| CT-SHELL-01 to 06 | [appShell.test.tsx](appShell.test.tsx) | Signed-in user and initials, current page marked, profile and sign out, mobile menu opens and closes, page header. |
| CT-LAWYER-01 to 08 | [lawyerDashboard.test.tsx](lawyerDashboard.test.tsx) | Greeting, stats from cases and roster, roster failure fallback, no-clients prompt, case search and reset, quick actions, error and retry. |
| CT-CLIENT-01 to 20 | [clientDashboard.test.tsx](clientDashboard.test.tsx) | Loading, error, empty and disabled-portal states; switching cases; billing totals, Stripe redirect, checkout errors, which invoices can be paid; document checklist, upload, storage failure, delete, download; reminders. |
| CT-ADMIN-01 to 17 | [adminDashboard.test.tsx](adminDashboard.test.tsx) | Stats, case assignment and failure, refresh; member filter, add and remove roles, delete (never yourself), create active or invited users; revoke and resend invitations; super-admin sections and organization creation. |
| CT-CASES-01 to 05 | [activeCasesPage.test.tsx](activeCasesPage.test.tsx) | Loading and totals, search by client, type or ID, status filter, open a case, error and retry. |
| CT-CASECFG-01 to 35 | [caseConfiguration.test.tsx](caseConfiguration.test.tsx) | Overview; saving case details; accepting and rejecting documents; reminders for missing documents; viewing (new tab, failure, blocked pop-up) and downloading files; rename and delete; custom requests and suites; lawyer and retainer uploads; download all; invoices and invoice creation; milestones; client reminders; portal permissions. |
| CT-NEWCASE-01 to 09 | [newCaseDialog.test.tsx](newCaseDialog.test.tsx) | Existing or new client, validation, server errors, loading and cancel. |
| CT-PROFILE-01 to 10 | [profileSettingsDialog.test.tsx](profileSettingsDialog.test.tsx) | Prefilled form, trimmed save, required fields, loading and error states, data deletion request. |
| CT-MFA-01 to 05 | [mfaSettings.test.tsx](mfaSettings.test.tsx) | Enrolment with recovery codes, wrong password or code, disabling MFA and its failure. |
| CT-COOKIE-01 to 06 | [cookieConsent.test.tsx](cookieConsent.test.tsx) | Banner shown or hidden by the stored choice, saving a choice, unknown stored values, cookie settings page. |
| CT-LIST-01 to 12 | [activeCases.test.tsx](activeCases.test.tsx) | `FilterBar`, `CasesTable`, and case status and priority helpers. |
| CT-ADMINFORM-01 to 09 | [adminDashboard.forms.test.tsx](adminDashboard.forms.test.tsx) | `ConfirmDialog` and `CreateUserForm`. |
| CT-DIALOG-01 to 12 | [caseConfigurationDialogs.test.tsx](caseConfigurationDialogs.test.tsx) | Rename, delete, and milestone dialogs. |

#### Known bugs

Each known bug has a test marked `it.fails`, so the suite stays green while the bug exists and fails
as soon as the bug is fixed. When that happens, change `it.fails` to `it`.

| ID | Bug |
| --- | --- |
| CT-CASECFG-07 | The Case Details status dropdown lists only four statuses, so a case in any other status (for example `application_prep`) is shown as "Intake". |

#### Rules for these tests

- Mock `@/lib/api` with an explicit list of functions. Do not spread the real module in with `importOriginal`, or a missed function can call a real server.
- Call `failOnUnmockedNetwork()` from [support/componentTestKit.ts](support/componentTestKit.ts) in any test that renders a screen. Any `fetch` that is not mocked fails the test, the same way `e2e/fixtures.ts` fails on unmocked endpoints.
- `vitest.config.mts` resets every mock and restores every spy before each test, so set up what a test needs inside that test or in `beforeEach`. Never rely on another test running first.
- Shared helpers (`buildCase`, `cloneWorkspace`, `rowStartingWith`, `statValue`, `displayDate`) live in the same file; do not copy them into test files.
- Fake API responses must match the real types in `lib/api.ts`. Do not use `as never` or `as any` casts.
- Find elements by role and label. Where a component gives no accessible name (some case-configuration fields and the client checklist items), the test notes why it walks the DOM instead.
- Build expected dates from timestamps with `displayDate()` so tests pass in every time zone.
- Give every new test the next free ID for its screen, and update the coverage table.

#### How this fits with the Playwright suite

The Playwright scenarios in `e2e/` (AUTH-01 to NAV-01) check whole journeys in a real browser. These tests check each screen's branches and request payloads in milliseconds. Some behaviour is covered at both levels on purpose, such as sign-in with MFA, case search and retry, new-case validation, and mobile navigation. Client, admin, and case-configuration workflows are covered only here.

These tests do **not** prove real API behaviour, authorization, persistence, file scanning, real Stripe checkout, email delivery, or styling. They run in jsdom, so a real redirect, a real new tab, and a real file download are checked only as far as the component's own handling; the browser suite is the place for those.

#### Local verification

October 13, 2026, Windows, Node 24.19.0, Vitest 5.0.0:

- The full Vitest suite passed (253 passed, 1 expected failure for CT-CASECFG-07). TypeScript and ESLint checks passed.
- The suite passed in 5 random test orders and in the UTC, UTC−11, UTC−10, UTC+9, and UTC+14 time zones. Set `TZ` in PowerShell; Git Bash drops time-zone names that contain `/`.
- 15 deliberate bugs were added to the app one at a time; each made at least one scenario fail, and the app code was restored after each.
- The 12 Playwright scenarios in `e2e/` passed against the same checkout, on both the development server and a production build (`CI=1`). One development-server run failed the compliance scenario with `net::ERR_ABORTED` during a Next.js Fast Refresh reload; the next two runs passed.

A passing local run does not claim that a remote CI run passed.

## Key Files

- [clientDashboard.permissions.test.tsx](clientDashboard.permissions.test.tsx) - Client dashboard role-based access tests
- [storybook.test.tsx](storybook.test.tsx) - Storybook story automation runner
- [permissionsSection.test.tsx](permissionsSection.test.tsx) - Permission/role UI tests
- [relativeTime.test.ts](relativeTime.test.ts) - Time formatting utility tests

## Getting Started

**Run all tests:**
```bash
npm test
```

**Run specific test file:**
```bash
npm test clientDashboard.permissions.test.tsx
```

**Watch mode (re-run on changes):**
```bash
npm test -- --watch
```

**Generate coverage report:**
```bash
npm test -- --coverage
```

**Run Storybook tests only:**
```bash
npm test storybook.test.tsx
```

## Testing Patterns

**Component Testing with React Testing Library:**
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '@/figma/components/MyComponent';

describe('MyComponent', () => {
  it('renders and responds to user input', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /submit/i });
    await user.click(button);
    
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

**Permission-Based Tests:**
```typescript
it('renders admin-only section when user has admin role', () => {
  render(<Dashboard user={{ roles: ['admin'] }} />);
  expect(screen.getByText(/admin panel/i)).toBeVisible();
});

it('hides admin section when user lacks permission', () => {
  render(<Dashboard user={{ roles: ['client'] }} />);
  expect(screen.queryByText(/admin panel/i)).not.toBeInTheDocument();
});
```

**Storybook Integration:**
- All Storybook stories are automatically validated to render
- Stories with `play()` functions are executed to test user interactions
- Adds visual regression safety without manual testing

## Test Configuration

- **Vitest Config**: [vitest.config.mts](../vitest.config.mts)
- **Setup File**: [vitest.setup.ts](../vitest.setup.ts) (initializes test environment)
- **Test Timeout**: 5000ms (configurable per test with `it(..., () => {}, 10000)`)

## Best Practices

1. **Accessible Queries**: Use `screen.getByRole()`, `screen.getByLabelText()` instead of selectors
2. **User Events**: Simulate real user interactions with `userEvent` instead of `fireEvent`
3. **Wait for Async**: Use `waitFor()` for async state updates
4. **Avoid Implementation Details**: Test behavior, not implementation
5. **Mock Externals**: Mock API calls and external dependencies

## Related Documentation

- See [../figma/](../figma/) for components being tested
- See [../lib/api.ts](../lib/api.ts) for API functions that tests may mock
- Vitest: https://vitest.dev/
- React Testing Library: https://testing-library.com/react
- Storybook Testing Library: https://storybook.js.org/docs/writing-tests/

