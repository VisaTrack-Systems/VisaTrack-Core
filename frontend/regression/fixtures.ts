import { randomUUID } from 'node:crypto';
import { test as base, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import type { CaseListItem, CaseWorkspace } from '../lib/api';

type Account = { email: string; password: string; id: string; api: APIRequestContext };
type Environment = {
  slug: string;
  organizationId: string;
  root: APIRequestContext;
  admin: Account;
  lawyer: Account;
  client: Account;
  otherClient: Account;
  foreignClient: Account;
};

export async function responseJson<T>(response: Pick<APIResponse, 'status' | 'text' | 'json'>, status: number): Promise<T> {
  expect(response.status(), await response.text()).toBe(status);
  return response.json() as Promise<T>;
}

function localURL(value: string): string {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', 'host.docker.internal'].includes(url.hostname)) {
    throw new Error('Live regression tests may only target a local development server.');
  }
  return url.origin;
}

export const test = base.extend<{ caseRecord: CaseListItem }, { environment: Environment }>({
  environment: [async ({ playwright }, provide) => {
    if (process.env.REGRESSION_ALLOW_MUTATIONS !== 'local') {
      throw new Error('Set REGRESSION_ALLOW_MUTATIONS=local to allow disposable local test data.');
    }
    const password = process.env.REGRESSION_BOOTSTRAP_PASSWORD;
    if (!password) throw new Error('REGRESSION_BOOTSTRAP_PASSWORD must be supplied; do not commit passwords.');
    localURL(process.env.REGRESSION_BASE_URL ?? 'http://localhost:3000');
    const apiURL = localURL(process.env.REGRESSION_API_URL ?? 'http://localhost:8000');
    const origin = localURL(process.env.REGRESSION_BASE_URL ?? 'http://localhost:3000');
    const anonymous = await playwright.request.newContext({ baseURL: apiURL, extraHTTPHeaders: { Origin: origin } });
    const authenticate = async (slug: string, email: string, accountPassword: string) => {
      const token = await responseJson<{ access_token: string }>(await anonymous.post('/api/v1/auth/login', {
        data: { organization_slug: slug, email, password: accountPassword },
      }), 200);
      return playwright.request.newContext({ baseURL: apiURL, extraHTTPHeaders: {
        Origin: origin, Authorization: `Bearer ${token.access_token}`,
      } });
    };
    const root = await authenticate(process.env.REGRESSION_BOOTSTRAP_SLUG ?? 'ronit-regression',
      process.env.REGRESSION_BOOTSTRAP_EMAIL ?? 'superadmin@regression.test', password);
    const contexts: APIRequestContext[] = [root];
    const organizations: string[] = [];
    const runId = randomUUID().slice(0, 8);
    const slug = `autoreg-${runId}`;
    try {
      const createOrganization = async (organizationSlug: string) => {
        const organization = await responseJson<{ id: string }>(await root.post('/api/v1/admin/organizations', {
          data: { name: `Automated Regression ${organizationSlug}`, slug: organizationSlug,
            contact_email: 'test@regression.test' },
        }), 201);
        organizations.push(organization.id);
        return organization.id;
      };
      const organizationId = await createOrganization(slug);
      const foreignSlug = `${slug}-other`;
      const foreignOrganizationId = await createOrganization(foreignSlug);
      const createAccount = async (role: string, suffix: string, orgId = organizationId, orgSlug = slug): Promise<Account> => {
        const accountPassword = `Regression-${randomUUID()}-Aa1!`;
        const email = `${suffix}-${runId}@regression.test`;
        const user = await responseJson<{ id: string }>(await root.post('/api/v1/admin/users', {
          data: { organization_id: orgId, email, first_name: suffix, last_name: 'Regression',
            role_slug: role, status: 'active', password: accountPassword },
        }), 201);
        const api = await authenticate(orgSlug, email, accountPassword);
        contexts.push(api);
        return { email, password: accountPassword, id: user.id, api };
      };
      const admin = await createAccount('org_admin', 'admin');
      const lawyer = await createAccount('lawyer', 'lawyer');
      const client = await createAccount('client', 'client');
      const otherClient = await createAccount('client', 'unrelated-client');
      const foreignClient = await createAccount('client', 'foreign-client', foreignOrganizationId, foreignSlug);
      await provide({ slug, organizationId, root, admin, lawyer, client, otherClient, foreignClient });
    } finally {
      for (const id of organizations.reverse()) {
        const deleted = await root.delete(`/api/v1/admin/organizations/${id}`);
        expect(deleted.status(), `Could not retire disposable regression organization ${id}`).toBe(204);
      }
      for (const api of contexts) {
        await api.post('/api/v1/auth/logout');
        await api.dispose();
      }
      await anonymous.dispose();
    }
  }, { scope: 'worker', timeout: 90_000 }],
  caseRecord: async ({ environment }, provide, testInfo) => {
    const record = await responseJson<CaseListItem>(await environment.lawyer.api.post('/api/v1/lawyer/cases', {
      data: { client_user_id: environment.client.id, case_type: `Regression ${testInfo.title.split(':')[0]}`,
        priority: 'medium' },
    }), 201);
    await provide(record);
  },
});

export { expect };

export async function dismissCookieConsent(page: Page) {
  const choice = await page.evaluate(() => window.localStorage.getItem('visatrack-cookie-consent'));
  if (choice !== 'essential' && choice !== 'all') {
    await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  }
}

export async function signIn(page: Page, account: Pick<Account, 'email' | 'password'>, slug: string) {
  await page.goto('/');
  await dismissCookieConsent(page);
  await page.getByLabel('Organization slug').fill(slug);
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign Out', exact: true, includeHidden: true })).toBeAttached();
}

export async function openCase(page: Page, caseNumber: string) {
  await page.getByRole('navigation', { name: 'Main', exact: true })
    .getByRole('button', { name: 'Cases', exact: true }).click();
  await page.getByLabel('Search cases').fill(caseNumber);
  await page.getByRole('row').filter({ hasText: caseNumber }).click();
  await expect(page.getByRole('navigation', { name: 'Case sections' })).toBeVisible();
}

export async function section(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Case sections' }).getByRole('button', { name, exact: true }).click();
}

export async function workspace(api: APIRequestContext, caseNumber: string) {
  return responseJson<CaseWorkspace>(await api.get(`/api/v1/cases/by-number/${caseNumber}/workspace`), 200);
}
