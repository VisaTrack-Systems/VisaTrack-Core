import { test as base, expect, type Page } from '@playwright/test';
import type { AuthLoginInput, CaseListItem, CurrentUser } from '../lib/api';

// Synthetic data only. The browser exercises real components; API traffic never
// leaves Playwright. Each test owns its session and can run independently.
export const credentials = {
  organization_slug: 'ui-test-firm',
  email: 'lawyer@example.test',
  password: 'Synthetic-password-123!',
} satisfies AuthLoginInput;

const user: CurrentUser = {
  id: '00000000-0000-4000-8000-000000000001',
  organization_id: '00000000-0000-4000-8000-000000000002',
  email: credentials.email, full_name: 'Alex Tester', status: 'active',
  roles: ['lawyer'], active_role: 'lawyer', onboarding_required: false,
  last_login_at: null,
};

export const cases: CaseListItem[] = [
  ['VT-1001', 'Jamie Chen', 'Work Permit', 'in_progress'],
  ['VT-1002', 'Morgan Singh', 'Express Entry', 'intake'],
  ['VT-1003', 'Taylor Roy', 'Study Permit', 'closed'],
].map(([number, client, type, status], index) => ({
  id: `00000000-0000-4000-8000-00000000001${index}`,
  organization_id: user.organization_id, case_number: number,
  client_name: client, case_type: type, status, priority: 'medium',
  primary_lawyer_name: user.full_name, target_filing_date: null,
  created_at: '2026-01-15T12:00:00Z',
}));

type MockApi = {
  signedIn: boolean;
  requireMfa: boolean;
  failCases: boolean;
  loginRequests: AuthLoginInput[];
  caseWrites: unknown[];
};

export const test = base.extend<{ api: MockApi }>({
  api: [async ({ page }, use) => {
    const api: MockApi = {
      signedIn: false, requireMfa: false, failCases: false,
      loginRequests: [], caseWrites: [],
    };
    const unexpected: string[] = [];
    const token = { access_token: 'synthetic-ui-token', token_type: 'bearer', expires_in_seconds: 900 };
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      const respond = (status: number, json: unknown) => route.fulfill({ status, json });
      if (method === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: {
          'Access-Control-Allow-Origin': request.headers().origin ?? '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type',
        } });
      } else if (path === '/api/v1/auth/login' && method === 'POST') {
        const body = request.postDataJSON() as AuthLoginInput;
        api.loginRequests.push(body);
        if (body.email !== credentials.email || body.password !== credentials.password || body.organization_slug !== credentials.organization_slug) {
          await respond(401, { detail: 'Invalid organization or credentials' });
        } else if (api.requireMfa && body.mfa_code !== '123456') {
          await respond(401, { detail: body.mfa_code ? 'Invalid MFA code' : 'MFA code required' });
        } else {
          api.signedIn = true;
          await respond(200, token);
        }
      } else if (path === '/api/v1/auth/refresh' && method === 'POST') {
        await respond(api.signedIn ? 200 : 401, api.signedIn ? token : { detail: 'Refresh token required' });
      } else if (path === '/api/v1/auth/me' && method === 'GET') {
        const authorized = api.signedIn && request.headers().authorization === `Bearer ${token.access_token}`;
        await respond(authorized ? 200 : 401, authorized ? user : { detail: 'Authentication required' });
      } else if (path === '/api/v1/auth/logout' && method === 'POST') {
        api.signedIn = false;
        await route.fulfill({ status: 204 });
      } else if (path === '/api/v1/lawyer/cases' && method === 'GET') {
        await respond(api.failCases ? 503 : 200, api.failCases ? { detail: 'Service unavailable' } : cases);
      } else if (path === '/api/v1/lawyer/clients' && method === 'GET') {
        await respond(200, []);
      } else if (method === 'POST' && ['/api/v1/lawyer/cases', '/api/v1/lawyer/clients'].includes(path)) {
        api.caseWrites.push(request.postDataJSON());
        await respond(503, { detail: 'Test service unavailable. Please try again.' });
      } else {
        unexpected.push(`${method} ${path}`);
        await respond(501, { detail: 'Unmocked test endpoint' });
      }
    });
    await use(api);
    expect(unexpected, 'Add an explicit fixture for unexpected API requests; never call the real backend').toEqual([]);
  }, { auto: true }],
});

export { expect };

export async function fillSignIn(page: Page, password = credentials.password) {
  await page.getByLabel('Organization slug').fill(credentials.organization_slug);
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
}

export async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essential only' }).click();
  await fillSignIn(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
}
