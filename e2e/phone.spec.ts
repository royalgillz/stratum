import { expect, test } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

const VISIBLE_TABS = [
  ['Listen', 'Listen to the grid'],
  ['Report', 'Report'],
  ['Family', 'Family'],
  ['Ledger', 'Shed Ledger'],
  ['Care', 'Breath Count'],
] as const;

test.describe('phone page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/phone/', { waitUntil: 'domcontentloaded' });
  });

  test('every tab lays out cleanly and shows its screen', async ({ page }) => {
    for (const [tab, heading] of VISIBLE_TABS) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expectSoundLayout(page);
    }
  });

  test('arrow keys move between tabs and the address keeps the screen', async ({ page }) => {
    await page.getByRole('tab', { name: 'Listen' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Report' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/#report$/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Report', exact: true })).toBeVisible();
  });

  test('creates a family and shows six words', async ({ page }) => {
    await page.getByRole('tab', { name: 'Family' }).click();
    await page.getByRole('button', { name: 'Create a family' }).click();
    const words = (await page.locator('.words').textContent())!.trim().split(/\s+/);
    expect(words).toHaveLength(6);
    await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible();
    await expectSoundLayout(page);
  });

  test('rejects a mistyped family word with a readable message', async ({ page }) => {
    await page.getByRole('tab', { name: 'Family' }).click();
    await page.getByLabel('Six family words').fill('abandon ability able about above xylophonez');
    await page.getByRole('button', { name: 'Join family' }).click();
    await expect(page.getByRole('alert')).toContainText('xylophonez');
  });

  test('OK without a family points the user to the Family tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Report' }).click();
    await page.getByRole('button', { name: 'I am OK' }).click();
    await expect(page.getByRole('dialog')).toContainText('Family tab');
  });

  test('opens the microphone and reports a tracker state, never a fake reading', async ({ page }) => {
    await page.getByRole('button', { name: 'Start listening' }).click();
    // Chrome's fake microphone plays a beep, not grid hum: the honest answer is NO HUM or calibrating.
    await expect(page.locator('#tier')).toHaveText(/NO HUM|Calibrating/, { timeout: 15_000 });
    await expectSoundLayout(page);
  });
});

test('hello page links to the phone page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Phone page' })).toBeVisible();
  await expectSoundLayout(page);
});
