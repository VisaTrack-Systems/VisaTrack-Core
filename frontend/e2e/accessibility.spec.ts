import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('sign-in screen has no serious accessibility violations', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Organization slug')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(({ impact }) =>
    impact === 'serious' || impact === 'critical'
  );

  expect(serious).toEqual([]);
});


test('sign-in controls are keyboard reachable', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});
