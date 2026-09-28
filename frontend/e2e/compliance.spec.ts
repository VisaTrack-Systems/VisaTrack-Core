import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('cookie choice and legal pages are reachable from the keyboard', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('region', { name: 'Cookie consent' })).toBeVisible();
  await page.getByRole('button', { name: 'Essential only' }).click();
  await expect(page.getByRole('region', { name: 'Cookie consent' })).toHaveCount(0);

  await page.goto('/legal/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByText('Ottawa, Ontario, Canada').first()).toBeVisible();
  await expect(page.getByText(/do not attach your IP address/)).toBeVisible();

  await page.goto('/legal/refund');
  await expect(page.getByRole('heading', { name: 'Refund policy' })).toBeVisible();
  await expect(page.getByText('There is no extra VisaTrack fee added at card checkout.')).toBeVisible();

  await page.goto('/privacy/deletion');
  await expect(page.getByRole('heading', { name: 'Data deletion request' })).toBeVisible();
  const confirm = page.getByRole('checkbox', { name: /delete the personal information/i });
  await expect(confirm).not.toBeChecked();
  await confirm.focus();
  await expect(confirm).toBeFocused();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(serious).toEqual([]);
});
