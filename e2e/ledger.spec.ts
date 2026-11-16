import { expect, test } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

test.describe('ledger screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/phone/#ledger', { waitUntil: 'domcontentloaded' });
  });

  test('shows an empty state until the phone listens', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Ledger' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Odds of a power cut', exact: true })).toBeVisible();
    await expect(page.locator('#ledger-empty')).toContainText('Not listening');
    await expect(page.getByText('resets when the page reloads')).toBeVisible();
    await expect(page.locator('table.ledger')).toHaveCount(0);
    await expectSoundLayout(page);
    await page.getByRole('button', { name: 'Go to Listen' }).click();
    await expect(page.getByRole('tab', { name: 'Listen' })).toHaveAttribute('aria-selected', 'true');
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
    await expect(page.getByText('anyone can send public reports')).toBeHidden(); // the caveats sit after the table, folded
    const table_top = (await table.boundingBox())!.y;
    expect(table_top, 'the table starts on the first screen').toBeLessThan(page.viewportSize()!.height);
    await page.getByText('How this is worked out').click();
    await expect(page.getByText('anyone can send public reports')).toBeVisible();
    await expectSoundLayout(page);
  });
});
