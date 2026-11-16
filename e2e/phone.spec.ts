import { expect, test } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

const VISIBLE_TABS = [
  ['Listen', 'Listen to the grid'],
  ['Report', 'Report'],
  ['Family', 'Family'],
  ['Ledger', 'Odds of a power cut'],
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
    const input = page.getByLabel('Six family words');
    await input.fill('abandon ability able about above xylophonez');
    await page.getByRole('button', { name: 'Join family' }).click();
    await expect(page.getByRole('alert')).toContainText('xylophonez');
    await expect(input).toHaveValue('abandon ability able about above xylophonez'); // one typo, not six words to retype
    await expect(input).toBeFocused();
    await input.fill('abandon ability able about above absent');
    await input.press('Enter'); // the phone keyboard's Go button submits
    await expect(page.locator('.words')).toBeFocused(); // the new words are read out
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Leave family' }).click();
    await expect(page.getByRole('button', { name: 'Create a family' })).toBeFocused();
    await expectSoundLayout(page);
  });

  test('OK without a family points the user to the Family tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Report' }).click();
    await page.getByRole('button', { name: 'I am OK' }).click();
    await expect(page.getByRole('dialog')).toContainText('Family tab');
    await page.getByRole('dialog').getByRole('button', { name: 'Go to Family tab' }).click();
    await expect(page.getByRole('tab', { name: 'Family' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Create a family' })).toBeVisible();
  });

  test('before listening: a small idle line, no claim of a live relay', async ({ page }) => {
    const tier = page.locator('#tier');
    await expect(tier).toHaveText('Not listening yet');
    expect(await tier.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeLessThan(24); // not alarm-sized
    await expect(page.locator('#relayCount')).toHaveText('Relaying starts when you tap Start listening.');
    await expectSoundLayout(page);
  });

  for (const [name, setup, says] of [
    ['refused', () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); }, 'Microphone permission was refused'],
    ['not https', () => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined }); }, 'must be opened over https'],
  ] as const) {
    test(`a microphone that will not open (${name}) says why in plain words`, async ({ page }) => {
      await page.addInitScript(setup);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Start listening' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Not listening.' })).toContainText(says);
      await expect(page.locator('#tier')).not.toContainText('undefined');
      await expect(page.getByRole('button', { name: 'Start listening' })).toBeEnabled();
      await expectSoundLayout(page);
    });
  }

  test('opens the microphone and reports a tracker state, never a fake reading', async ({ page }) => {
    await page.getByRole('button', { name: 'Start listening' }).click();
    // Chrome's fake microphone plays a beep, not grid hum: the honest answer is NO HUM or calibrating.
    await expect(page.locator('#tier')).toHaveText(/NO HUM|Calibrating/, { timeout: 15_000 });
    await expect(page.locator('#relayCount')).toHaveText('Passed on 0 messages this session · LIVE');
    await expectSoundLayout(page);
  });
});

test('home page says what STRATUM does, District 7 and judge mode first, spikes tucked away', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('hears the grid weaken before a power cut')).toBeVisible();
  await expect(page.getByText('Rung 0')).toHaveCount(0);
  const links = page.locator('a:visible');
  await expect(links).toHaveText(['District 7', 'Coverage matrix', 'Judge mode', 'Phone page']);
  for (const a of await links.all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('link', { name: 'Emitter' })).toBeHidden();
  await page.getByText('Developer spikes').click();
  await expect(page.getByRole('link', { name: 'Emitter' })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light dark');
  await expectSoundLayout(page);
});
