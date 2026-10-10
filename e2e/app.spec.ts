import { expect, test } from '@playwright/test';

test('shows the application title', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Hello, fin-dev-test' })).toBeVisible();
});
