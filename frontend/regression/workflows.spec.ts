import { createHmac, randomUUID } from 'node:crypto';
import { test, expect, responseJson, signIn, openCase, section, workspace, dismissCookieConsent } from './fixtures';

test('REG-AUTH-01: invalid password, real login, reload, logout, and reload', async ({ page, environment }) => {
  await page.goto('/');
  await dismissCookieConsent(page);
  await page.getByLabel('Organization slug').fill(environment.slug);
  await page.getByLabel('Email', { exact: true }).fill(environment.lawyer.email);
  await page.getByLabel('Password', { exact: true }).fill('Incorrect-regression-password!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid organization or credentials' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(environment.lawyer.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, lawyer', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, lawyer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('REG-ROLE-01: organization administrator sees real organization members', async ({ page, environment }) => {
  await signIn(page, environment.admin, environment.slug);
  await expect(page.getByRole('heading', { name: 'Welcome back, admin', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'Members', exact: true }).click();
  await expect(page.getByText(environment.lawyer.email, { exact: true })).toBeVisible();
  await expect(page.getByText(environment.client.email, { exact: true })).toBeVisible();
});

test('REG-CASE-01: create a case in the browser, persist it, and view it as the client', async ({ page, browser, environment }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await page.getByRole('button', { name: 'New Case', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Case' });
  await dialog.getByRole('button', { name: 'Existing Client', exact: true }).click();
  await dialog.getByLabel('Case Type', { exact: true }).fill('Browser Regression Work Permit');
  await dialog.getByLabel('Select Client', { exact: true }).selectOption(environment.client.id);
  const created = page.waitForResponse(response => response.url().endsWith('/api/v1/lawyer/cases') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Create Case', exact: true }).click();
  const record = await responseJson<{ case_number: string }>(await created, 201);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await openCase(page, record.case_number);
  await expect(page.getByText('Browser Regression Work Permit', { exact: false }).first()).toBeVisible();
  const clientContext = await browser.newContext();
  try {
    const clientPage = await clientContext.newPage();
    await signIn(clientPage, environment.client, environment.slug);
    await expect(clientPage.getByText(record.case_number, { exact: false }).first()).toBeVisible();
  } finally { await clientContext.close(); }
});

test('REG-CASE-02: case search, status filter, no matches, and reset use persisted records', async ({ page, environment, caseRecord }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'Cases', exact: true }).click();
  await page.getByLabel('Search cases').fill(caseRecord.case_number);
  await expect(page.getByRole('row').filter({ hasText: caseRecord.case_number })).toBeVisible();
  await page.getByLabel('Filter by status').selectOption('Closed');
  await expect(page.getByText('No cases found matching your search criteria')).toBeVisible();
  await page.getByLabel('Filter by status').selectOption('all');
  await expect(page.getByRole('row').filter({ hasText: caseRecord.case_number })).toBeVisible();
});

test('REG-DETAILS-01: save case details and keep internal notes out of the client response', async ({ page, environment, caseRecord }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await openCase(page, caseRecord.case_number);
  await section(page, 'Case Details');
  await page.getByRole('combobox').nth(0).selectOption('high');
  await page.getByRole('combobox').nth(1).selectOption('in_progress');
  await page.locator('textarea').nth(0).fill('Visible regression description');
  await page.locator('textarea').nth(1).fill('PRIVATE regression internal note');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByText('Case details updated.', { exact: true })).toBeVisible();
  const saved = await workspace(environment.lawyer.api, caseRecord.case_number);
  expect(saved.case).toMatchObject({ priority: 'high', status: 'in_progress',
    description: 'Visible regression description', internal_notes: 'PRIVATE regression internal note' });
  const clientView = await workspace(environment.client.api, caseRecord.case_number);
  expect(clientView.case.internal_notes).toBeNull();
  expect(JSON.stringify(clientView)).not.toContain('PRIVATE regression internal note');
  await page.reload();
  await openCase(page, caseRecord.case_number);
  await section(page, 'Case Details');
  await expect(page.getByRole('combobox').nth(0)).toHaveValue('high');
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('in_progress');
});

test('REG-MILESTONE-01: create a milestone, hide it from the client, and delete it', async ({ page, environment, caseRecord }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await openCase(page, caseRecord.case_number);
  await section(page, 'Milestones');
  await page.getByRole('button', { name: 'Add Milestone', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Milestone', exact: true });
  await dialog.getByPlaceholder('e.g., Application submitted to IRCC').fill('Regression milestone');
  await dialog.getByPlaceholder('Optional details visible in timeline.').fill('Visible milestone details');
  await dialog.getByRole('button', { name: 'Add Milestone', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await workspace(environment.client.api, caseRecord.case_number)).milestones.some(item => item.name === 'Regression milestone')).toBe(true);
  await page.getByRole('button', { name: 'Hide from Client', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show to Client', exact: true })).toBeVisible();
  expect((await workspace(environment.client.api, caseRecord.case_number)).milestones.some(item => item.name === 'Regression milestone')).toBe(false);
  await page.getByRole('button', { name: 'Delete Milestone', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Regression milestone', exact: true })).toHaveCount(0);
  expect((await workspace(environment.lawyer.api, caseRecord.case_number)).milestones).toHaveLength(0);
});

test('REG-REMINDER-01: lawyer posts a reminder and the client opens it', async ({ page, browser, environment, caseRecord }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await openCase(page, caseRecord.case_number);
  await section(page, 'Reminders');
  await page.getByPlaceholder('e.g., Document Submission Reminder').fill('Regression reminder');
  await page.getByPlaceholder('Write the reminder for the client...').fill('Please review your synthetic case.');
  await page.getByRole('button', { name: 'Post Reminder', exact: true }).click();
  await expect(page.getByText('Regression reminder', { exact: true })).toBeVisible();
  const clientContext = await browser.newContext();
  try {
    const clientPage = await clientContext.newPage();
    await signIn(clientPage, environment.client, environment.slug);
    const caseSelector = clientPage.getByLabel('Select Case', { exact: true });
    if (await caseSelector.count()) await caseSelector.selectOption(caseRecord.case_number);
    await clientPage.getByRole('button').filter({ hasText: 'Regression reminder' }).first().click();
    await expect(clientPage.getByRole('dialog', { name: 'Regression reminder' })).toBeVisible();
    await expect.poll(async () => (await workspace(environment.lawyer.api, caseRecord.case_number)).reminders[0]?.read_at).toEqual(expect.any(String));
  } finally { await clientContext.close(); }
});

test('REG-DOCUMENT-01: create a custom document suite and request, then rename and delete the request', async ({ page, environment, caseRecord }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await openCase(page, caseRecord.case_number);
  await section(page, 'Document Requests');
  await page.getByRole('button', { name: 'Create Suite', exact: true }).click();
  const suiteDialog = page.getByRole('dialog', { name: 'Create Custom Suite' });
  await suiteDialog.getByPlaceholder('e.g., Country-Specific Requirements').fill('Regression Suite');
  await suiteDialog.getByRole('button', { name: 'Create Suite', exact: true }).click();
  await expect(suiteDialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Custom Document', exact: true }).click();
  const documentDialog = page.getByRole('dialog');
  await documentDialog.getByPlaceholder('e.g., Additional Proof of Employment').fill('Regression Document');
  const savedSuite = (await workspace(environment.lawyer.api, caseRecord.case_number)).document_suites.find(item => item.name === 'Regression Suite');
  expect(savedSuite).toBeDefined();
  await documentDialog.getByRole('combobox').nth(0).selectOption(savedSuite!.id);
  await documentDialog.getByRole('button', { name: 'Add Document', exact: true }).click();
  await expect(documentDialog).toHaveCount(0);
  let record = await workspace(environment.lawyer.api, caseRecord.case_number);
  expect(record.documents.some(item => item.name === 'Regression Document')).toBe(true);
  const row = page.getByRole('row').filter({ hasText: 'Regression Document' });
  await page.getByRole('button', { name: 'Expand Suites', exact: true }).click();
  await row.getByRole('button', { name: 'Rename Document', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Renamed Regression Document');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Renamed Regression Document' })).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'Renamed Regression Document' }).getByRole('button', { name: 'Delete Document', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Renamed Regression Document' })).toHaveCount(0);
  record = await workspace(environment.lawyer.api, caseRecord.case_number);
  expect(record.documents.some(item => item.name === 'Renamed Regression Document')).toBe(false);
});

test('REG-PERMISSION-01: disabling the portal persists and blocks the client workspace', async ({ page, environment, caseRecord }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await openCase(page, caseRecord.case_number);
  await section(page, 'Sharing / Permissions');
  await page.getByRole('combobox').nth(0).selectOption('disabled');
  await page.getByRole('button', { name: 'Save Permissions', exact: true }).click();
  await expect(page.getByText('Client portal visibility updated.', { exact: true })).toBeVisible();
  expect((await workspace(environment.lawyer.api, caseRecord.case_number)).portal_permissions.portal_access).toBe('disabled');
  const clientResponse = await environment.client.api.get(`/api/v1/cases/by-number/${caseRecord.case_number}/workspace`);
  if (clientResponse.status() === 200) {
    const clientView = await clientResponse.json();
    expect(clientView.portal_permissions.portal_access).toBe('disabled');
    expect(clientView.documents).toHaveLength(0);
    expect(clientView.milestones).toHaveLength(0);
    expect(clientView.reminders).toHaveLength(0);
  } else { expect([403, 404]).toContain(clientResponse.status()); }
});

test('REG-PROFILE-01: profile changes persist after reload', async ({ page, environment }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Profile Settings' });
  await dialog.getByLabel('Phone (optional)', { exact: true }).fill('+1 613 555 0100');
  await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Phone (optional)', { exact: true })).toHaveValue('+1 613 555 0100');
});

test('REG-INVOICE-01: create a real invoice and expose the correct total to its client', async ({ page, environment, caseRecord }) => {
  await signIn(page, environment.lawyer, environment.slug);
  await openCase(page, caseRecord.case_number);
  await section(page, 'Payments & Invoices');
  await page.getByLabel('Description', { exact: true }).fill('Regression professional services');
  await page.getByLabel('Amount before tax (CAD)', { exact: true }).fill('100');
  await page.getByLabel('Tax (%)', { exact: true }).fill('13');
  const dueDate = new Date(); dueDate.setUTCDate(dueDate.getUTCDate() + 7);
  await page.getByLabel('Due date', { exact: true }).fill(dueDate.toISOString().slice(0, 10));
  const created = page.waitForResponse(response => response.url().includes('/invoices') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create and send invoice', exact: true }).click();
  await responseJson(await created, 201);
  await expect(page.getByRole('table')).toContainText('113.00');
  const clientView = await workspace(environment.client.api, caseRecord.case_number);
  expect(clientView.billing_summary.remaining).toBe(113);
  expect(clientView.payment_items).toHaveLength(1);
  expect(clientView.payment_items[0].amount_paid).toBe(0);
});

test('REG-INVITE-01: activate an invited client through the real invitation page', async ({ page, environment }) => {
  const email = `invite-${randomUUID().slice(0, 8)}@regression.test`;
  const invited = await responseJson<{ invitation_url: string }>(await environment.admin.api.post('/api/v1/admin/users', {
    data: { organization_id: environment.organizationId, email, first_name: 'Invited', last_name: 'Regression', role_slug: 'client', status: 'invited' },
  }), 201);
  expect(invited.invitation_url).toContain('/invite#token=');
  const invitationURL = new URL(invited.invitation_url);
  await page.goto(invitationURL.pathname + invitationURL.hash);
  await dismissCookieConsent(page);
  await page.getByLabel('New password', { exact: true }).fill('Regression-Invitation-Aa1!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Regression-Invitation-Aa1!');
  await page.locator('#accept-terms').check();
  await page.locator('#age-consent').check();
  await page.getByRole('button', { name: 'Activate account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account activated', exact: true })).toBeVisible();
  await signIn(page, { email, password: 'Regression-Invitation-Aa1!' }, environment.slug);
});

test('REG-ACCESS-01: client cannot use lawyer/admin APIs or read unrelated or foreign cases', async ({ environment, caseRecord }) => {
  for (const route of ['/api/v1/lawyer/cases', '/api/v1/admin/users']) {
    expect((await environment.client.api.get(route)).status()).toBe(403);
  }
  const path = `/api/v1/cases/by-number/${caseRecord.case_number}/workspace`;
  expect((await environment.otherClient.api.get(path)).status()).toBe(404);
  expect((await environment.foreignClient.api.get(path)).status()).toBe(404);
});

test('REG-READONLY-01: read-only portal retains client-visible milestones', async ({ environment, caseRecord }) => {
  const base = `/api/v1/cases/by-number/${caseRecord.case_number}`;
  await responseJson(await environment.lawyer.api.post(`${base}/milestones`, { data: {
    name: 'Read-only visible milestone', status: 'not_started', client_visible: true,
  } }), 201);
  const current = await workspace(environment.lawyer.api, caseRecord.case_number);
  await responseJson(await environment.lawyer.api.put(`${base}/permissions`, {
    data: { ...current.portal_permissions, portal_access: 'read_only' },
  }), 200);
  const clientView = await workspace(environment.client.api, caseRecord.case_number);
  expect(clientView.milestones.map(item => item.name)).toContain('Read-only visible milestone');
});

test('REG-READONLY-02: read-only portal prevents client reminder responses', async ({ environment, caseRecord }) => {
  const base = `/api/v1/cases/by-number/${caseRecord.case_number}`;
  const reminder = await responseJson<{ id: string }>(await environment.lawyer.api.post(`${base}/reminders`, {
    data: { title: 'Read-only reminder', body: 'Client must not respond in read-only mode.', send_email: false },
  }), 201);
  const current = await workspace(environment.lawyer.api, caseRecord.case_number);
  await responseJson(await environment.lawyer.api.put(`${base}/permissions`, {
    data: { ...current.portal_permissions, portal_access: 'read_only' },
  }), 200);
  expect((await environment.client.api.post(`${base}/reminders/${reminder.id}/acknowledge`)).status()).toBe(403);
});

function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase().replace(/=+$/, '')].map(character => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  return ((digest.readUInt32BE(digest[digest.length - 1] & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

test('REG-MFA-01: real enrolled MFA rejects an invalid code and accepts an authenticator code', async ({ page, playwright, environment }) => {
  const email = `mfa-${randomUUID().slice(0, 8)}@regression.test`;
  const password = `Regression-${randomUUID()}-Aa1!`;
  await responseJson(await environment.admin.api.post('/api/v1/admin/users', {
    data: { organization_id: environment.organizationId, email, first_name: 'MFA', last_name: 'Regression', role_slug: 'client', status: 'active', password },
  }), 201);
  const api = await playwright.request.newContext({ baseURL: process.env.REGRESSION_API_URL ?? 'http://localhost:8000' });
  try {
    const tokens = await responseJson<{ access_token: string }>(await api.post('/api/v1/auth/login', {
      data: { organization_slug: environment.slug, email, password },
    }), 200);
    const headers = { Authorization: `Bearer ${tokens.access_token}` };
    const enrollment = await responseJson<{ secret: string }>(await api.post('/api/v1/auth/mfa/enroll', { headers, data: { current_password: password } }), 200);
    await responseJson(await api.post('/api/v1/auth/mfa/verify', { headers, data: { code: totp(enrollment.secret) } }), 200);
    await page.goto('/');
    await dismissCookieConsent(page);
    await page.getByLabel('Organization slug').fill(environment.slug);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByLabel('Authenticator or recovery code')).toBeVisible();
    const valid = totp(enrollment.secret);
    const invalid = (valid[0] === '0' ? '1' : '0') + valid.slice(1);
    await page.getByLabel('Authenticator or recovery code').fill(invalid);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid MFA code' })).toBeVisible();
    await page.getByLabel('Authenticator or recovery code').fill(totp(enrollment.secret));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toBeVisible();
  } finally { await api.dispose(); }
});

test('REG-PUBLIC-01: cookie choice persists and public legal pages load', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Cookie consent' })).toHaveCount(0);
  for (const [path, heading] of [['/legal/privacy', 'Privacy policy'], ['/legal/refund', 'Refund policy'], ['/privacy/deletion', 'Data deletion request']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});

test('REG-MOBILE-01: real signed-in mobile navigation opens Cases and closes', async ({ page, environment }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, environment.lawyer, environment.slug);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'Cases', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Active Cases', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveAttribute('aria-expanded', 'false');
});
