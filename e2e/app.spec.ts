import { expect, test } from '@playwright/test';

test('redirects to the dashboard and shows live instrument data', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Realtime Fintech Dashboard' })).toBeVisible();

  // Wait for the first generated batch to arrive and render a real price
  // in the "Last price" column specifically (the first column is Symbol).
  await expect(page.locator('td.cdk-column-lastPrice').first()).toContainText('$', {
    timeout: 10_000,
  });
});

test('navigates to settings and back without losing the dashboard', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.waitForURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'Producer settings' })).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Live market dashboard' })).toBeVisible();
});

test('shows a not-found page for an unknown route', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
