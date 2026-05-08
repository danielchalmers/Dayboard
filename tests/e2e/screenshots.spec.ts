import { expect, test } from '@playwright/test';

test('captures release screenshots', async ({ page }) => {
  await page.goto('/options.html');
  await page.getByLabel('Name').fill('Release day');
  await page.getByLabel('Date and time').fill('2028-05-08T10:00');
  await page.getByRole('button', { name: 'Add countdown' }).click();

  await page.goto('/newtab.html');
  await expect(page.getByText('Release day')).toBeVisible();
  await page.screenshot({
    path: 'artifacts/screenshots/newtab.png',
    fullPage: true
  });

  await page.goto('/popup.html');
  await page.screenshot({
    path: 'artifacts/screenshots/popup.png',
    fullPage: true
  });

  await page.goto('/options.html');
  await page.screenshot({
    path: 'artifacts/screenshots/options.png',
    fullPage: true
  });
});
