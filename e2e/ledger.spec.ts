import { expect, test } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

test.describe('ledger screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/phone/#ledger', { waitUntil: 'domcontentloaded' });
  });

  test('shows an empty state until the phone listens', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Ledger' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Shed Ledger', exact: true })).toBeVisible();
    await expect(page.locator('#ledger-empty')).toContainText('Not listening');
    await expect(page.getByText('resets when the page reloads')).toBeVisible();
    await expect(page.locator('table.ledger')).toHaveCount(0);
    await expectSoundLayout(page);
  });

  test('shows levels 1 to 6 with no data yet once listening, without horizontal scroll', async ({ page }) => {
    await page.getByRole('tab', { name: 'Listen' }).click();
    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.locator('#tier')).toHaveText(/NO HUM|Calibrating/, { timeout: 15_000 });
    await page.getByRole('tab', { name: 'Ledger' }).click();
    const table = page.locator('table.ledger');
    await expect(table.locator('caption')).toContainText('(LIVE)');
    await expect(table.locator('tbody tr')).toHaveCount(6);
    await expect(table.locator('tbody td', { hasText: 'no data yet' })).toHaveCount(12);
    await expect(table.getByRole('columnheader', { name: /AMBER/ })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /RED/ })).toBeVisible();
    await expect(page.getByText('anyone can send public reports')).toBeVisible();
    await expectSoundLayout(page);
  });
});
