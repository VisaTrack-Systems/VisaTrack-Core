import { test, expect, signIn } from './fixtures';

test('CASE-01: search, combine a status filter, and recover from no matches', async ({ page }) => {
  await test.step('Sign in and open Cases', async () => {
    await signIn(page);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Cases', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Active Cases', exact: true })).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(4);
  });
  await test.step('Search by client and combine with a conflicting status', async () => {
    await page.getByLabel('Search cases').fill('jamie');
    await expect(page.getByRole('row')).toHaveCount(2);
    await expect(page.getByRole('row', { name: /VT-1001/ })).toBeVisible();
    await page.getByLabel('Filter by status').selectOption('Closed');
    await expect(page.getByText('No cases found matching your search criteria')).toBeVisible();
  });
  await test.step('Clear search, then reset status and search by case ID and type', async () => {
    await page.getByLabel('Search cases').fill('');
    await expect(page.getByRole('row', { name: /VT-1003/ })).toBeVisible();
    await page.getByLabel('Filter by status').selectOption('all');
    await expect(page.getByRole('row')).toHaveCount(4);
    for (const term of ['vt-1002', 'express entry']) {
      await page.getByLabel('Search cases').fill(term);
      await expect(page.getByRole('row')).toHaveCount(2);
      await expect(page.getByRole('row', { name: /Morgan Singh/ })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Back to Dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
  });
});

test('CASE-02: a failed case list can be retried', async ({ page, api }) => {
  await signIn(page);
  await test.step('Open Cases while the API is unavailable', async () => {
    api.failCases = true;
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Cases', exact: true }).click();
    await expect(page.getByText('Failed to load active cases.', { exact: true })).toBeVisible();
  });
  await test.step('Retry after service recovery', async () => {
    api.failCases = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('row', { name: /VT-1001/ })).toBeVisible();
    await expect(page.getByText('Failed to load active cases.', { exact: true })).toHaveCount(0);
  });
});

test('CASE-03: validate a new case and cancel without creating data', async ({ page, api }) => {
  await signIn(page);
  const dialog = page.getByRole('dialog', { name: 'Create New Case' });
  await test.step('Open the dialog and check required new-client details', async () => {
    await page.getByRole('button', { name: 'New Case', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Create Case', exact: true }).click();
    await expect(dialog.getByLabel('Client Email')).toBeFocused();
    await expect(dialog.getByLabel('Client Email')).toHaveAttribute('required', '');
    expect(api.caseWrites).toHaveLength(0);
  });
  await test.step('Edit fields, cancel, and reopen without the abandoned values', async () => {
    await dialog.getByLabel('Case Type', { exact: true }).fill('Visitor Visa');
    await dialog.getByLabel('First Name', { exact: true }).fill('Unsubmitted');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'New Case', exact: true }).click();
    await expect(dialog.getByLabel('First Name', { exact: true })).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New Case', exact: true })).toBeFocused();
    expect(api.caseWrites).toHaveLength(0);
  });
});

test('CASE-04: failed case submission preserves entered client details', async ({ page, api }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'New Case', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Case' });
  await test.step('Complete and submit a new-client case', async () => {
    await dialog.getByLabel('Client Email').fill('new-client@example.test');
    await dialog.getByLabel('First Name', { exact: true }).fill('Sam');
    await dialog.getByLabel('Last Name', { exact: true }).fill('Test');
    await dialog.getByRole('button', { name: 'Create Case', exact: true }).click();
  });
  await test.step('The service error appears without losing the form', async () => {
    await expect(dialog.getByText(/Test service unavailable/)).toBeVisible();
    await expect(dialog.getByLabel('Client Email')).toHaveValue('new-client@example.test');
    await expect(dialog.getByLabel('First Name', { exact: true })).toHaveValue('Sam');
    await expect(dialog.getByRole('button', { name: 'Create Case', exact: true })).toBeEnabled();
    expect(api.caseWrites).toEqual([{
      email: 'new-client@example.test', first_name: 'Sam', last_name: 'Test', send_invite: true,
    }]);
  });
});

test('NAV-01: mobile navigation opens, selects Cases, and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await test.step('Open the navigation drawer', async () => {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  });
  await test.step('Select Cases and return to the content', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Cases', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Active Cases', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Main' })).not.toBeVisible();
  });
});
