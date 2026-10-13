import { test, expect, fillSignIn, signIn, credentials } from './fixtures';

test('AUTH-01: required fields prevent an empty sign-in request', async ({ page, api }) => {
  await test.step('Open sign-in and submit without credentials', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  });
  await test.step('The first required field receives focus and nothing is submitted', async () => {
    await expect(page.getByLabel('Organization slug')).toBeFocused();
    await expect(page.getByLabel('Organization slug')).toHaveAttribute('required', '');
    expect(api.loginRequests).toHaveLength(0);
  });
});

test('AUTH-02: invalid credentials show an error and can be corrected', async ({ page, api }) => {
  await test.step('Try an incorrect password', async () => {
    await page.goto('/');
    await fillSignIn(page, 'Incorrect-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid organization or credentials' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  });
  await test.step('Correct the password and reach the lawyer dashboard', async () => {
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
    expect(api.loginRequests).toHaveLength(2);
    expect(api.loginRequests[1]).toEqual(credentials);
  });
});

test('AUTH-03: sign-in survives reload and sign-out clears the session', async ({ page, api }) => {
  await test.step('Sign in through the form', async () => { await signIn(page); });
  await test.step('Reload and restore the session', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
  });
  await test.step('Sign out, then reload and remain signed out', async () => {
    const logout = page.waitForResponse('**/api/v1/auth/logout');
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await logout;
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    expect(api.signedIn).toBe(false);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toHaveCount(0);
  });
});

test('AUTH-04: MFA challenge accepts a valid second factor after an invalid code', async ({ page, api }) => {
  api.requireMfa = true;
  await test.step('Enter credentials and see the MFA challenge', async () => {
    await page.goto('/');
    await fillSignIn(page);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByLabel('Authenticator or recovery code')).toBeVisible();
  });
  await test.step('Reject an incorrect code, then accept the fixture code', async () => {
    await page.getByLabel('Authenticator or recovery code').fill('000000');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid MFA code' })).toBeVisible();
    await page.getByLabel('Authenticator or recovery code').fill('123456');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
    expect(api.loginRequests.at(-1)?.mfa_code).toBe('123456');
  });
});
