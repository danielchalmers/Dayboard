import { expect, test } from '@playwright/test';

test('new tab renders the clock dashboard', async ({ page }) => {
  await page.goto('/newtab.html');

  await expect(page.getByRole('heading', { name: /\d/ })).toBeVisible();
  await expect(page.getByText(/Good morning|Good afternoon|Good evening/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No countdown yet' })).toBeVisible();
});

test('popup renders quick controls', async ({ page }) => {
  await page.goto('/popup.html');

  await expect(page.getByText('Clockboard')).toBeVisible();
  await expect(page.getByLabel('Show countdown on new tab')).toBeVisible();
});

test('options page creates a countdown', async ({ page }) => {
  await page.goto('/options.html');

  await page.getByLabel('Name').fill('Release');
  await page.getByLabel('Date and time').fill('2028-05-08T10:00');
  await page.getByRole('button', { name: 'Add countdown' }).click();

  await expect(page.getByText('Countdown saved.')).toBeVisible();
  await expect(page.getByText('Release')).toBeVisible();
});
