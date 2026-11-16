import { expect, test, type Page } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

const DISCLAIMER = /Decision aid, not a medical device/;

async function choose(page: Page, years: string, months = '0', cough = 'Yes') {
  await page.getByLabel('Years').selectOption(years);
  await page.getByLabel('Months').selectOption(months);
  if (years !== '5') await page.getByRole('radio', { name: cough }).check();
}

test.describe('Care tab: Breath Count', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install(); // before the page loads, so performance.now and timers are fake
    await page.goto('/src/phone/#care', { waitUntil: 'domcontentloaded' });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000)); // no real time leaks into the count
  });

  test('shows the disclaimer and lays out cleanly', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Care' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('note')).toContainText(DISCLAIMER);
    await expect(page.getByRole('heading', { name: 'Breath Count' })).toBeVisible();
    await expect(page.getByRole('note')).toBeVisible();
    await expectSoundLayout(page);
    await choose(page, '2');
    await expect(page.getByRole('button', { name: 'Start 60-second count' })).toBeEnabled();
    await expectSoundLayout(page);
  });

  test('five or older: says the aid is not for this child and offers no count', async ({ page }) => {
    await choose(page, '5');
    await expect(page.locator('#result')).toContainText('This aid is for children under five only.');
    await expect(page.getByRole('button', { name: 'Start 60-second count' })).toBeHidden();
    await expect(page.getByRole('note')).toBeVisible();
    await expectSoundLayout(page);
  });

  test('the tap target is at least 120 px tall, with countdown, tap count and Stop', async ({ page }) => {
    await choose(page, '2');
    await page.getByRole('button', { name: 'Start 60-second count' }).click();
    const tap = page.getByRole('button', { name: 'Tap once per breath' });
    expect((await tap.boundingBox())!.height).toBeGreaterThanOrEqual(120);
    await tap.click();
    await expect(page.locator('#taps')).toHaveText('1 breath');
    await page.clock.runFor(10_500);
    await expect(page.locator('#left')).toHaveText(/^(49|50) s left$/);
    await expect(page.locator('#announce')).toHaveText('50 seconds left');
    await page.clock.runFor(3000); // 47 s left: still the 10 s announcement, not one per second
    await expect(page.locator('#announce')).toHaveText('50 seconds left');
    await expect(page.getByRole('note')).toBeVisible();
    await expectSoundLayout(page);
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.locator('#result')).toContainText('RECOUNT');
  });

  for (const [outcome, breaths, every] of [['GREEN', 30, 1900], ['AMBER', 45, 1300]] as const) {
    test(`a full count of ${breaths} breaths at 2 years gives ${outcome}`, async ({ page }) => {
      await choose(page, '2');
      await page.getByRole('button', { name: 'Start 60-second count' }).click();
      const tap = page.getByRole('button', { name: 'Tap once per breath' });
      for (let i = 0; i < breaths; i++) {
        await page.clock.runFor(every);
        await tap.click();
      }
      await page.clock.runFor(61_000 - breaths * every);
      const result = page.locator('#result');
      await expect(result).toContainText(outcome);
      await expect(result).toContainText(`Rate: ${breaths} breaths per minute`);
      await expect(result).toContainText(' · LIVE');
      await expect(result).toBeFocused();
      await expect(page.getByRole('button', { name: 'Request medicine' })).toBeVisible({ visible: outcome === 'AMBER' });
      await expect(page.getByRole('note')).toBeVisible();
      await expectSoundLayout(page);
    });
  }

  test('0 years: no card until months are chosen; 1 month refers without a count', async ({ page }) => {
    await page.getByLabel('Years').selectOption('0');
    await expect(page.locator('#result')).toBeHidden();
    await page.getByLabel('Months').selectOption('1');
    await expect(page.locator('#result')).toContainText('REFER');
    await expect(page.getByRole('button', { name: 'Start 60-second count' })).toBeHidden();
    await page.getByLabel('Months').selectOption('6');
    await expect(page.locator('#result')).toBeHidden();
    await expectSoundLayout(page);
  });

  test('a danger sign gives RED at once, without cough or a count', async ({ page }) => {
    await page.getByLabel('Years').selectOption('2');
    await page.getByLabel('Convulsions (fits)').check();
    const result = page.locator('#result');
    await expect(result).toContainText('RED');
    await expect(result).toContainText('Rate: none');
    await expect(page.getByRole('button', { name: 'Request medicine' })).toBeVisible();
    await expect(page.locator('#where')).toHaveText('Sends for level 5, sector A (change on the Report tab).');
    const box = async (name: string) => (await page.getByLabel(name).boundingBox())!;
    expect((await box('Chest indrawing (the lower chest pulls in when the child breathes in)')).width).toBe((await box('Vomits everything')).width);
    await expectSoundLayout(page);
    await page.getByLabel('Convulsions (fits)').uncheck();
    await expect(result).toBeHidden();
  });

  test('no cough: NOT ASSESSED at once, no rate and no count', async ({ page }) => {
    await choose(page, '2', '0', 'No');
    const result = page.locator('#result');
    await expect(result).toContainText('NOT ASSESSED');
    await expect(result).not.toContainText('Rate');
    await expect(page.getByRole('button', { name: 'Start 60-second count' })).toBeDisabled();
    await expectSoundLayout(page);
  });
});

test('a send that cannot play says it was not sent', async ({ page }) => {
  await page.addInitScript(() => {
    (window as { AudioContext: unknown }).AudioContext = class { constructor() { throw new Error('audio blocked'); } };
  });
  await page.goto('/src/phone/#family', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create a family' }).click();
  await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible();
  await page.getByRole('tab', { name: 'Care' }).click();
  await page.getByLabel('Years').selectOption('2');
  await page.getByLabel('Convulsions (fits)').check();
  await page.getByRole('button', { name: 'Request medicine' }).click();
  await expect(page.locator('#screen-care #sent')).toHaveText(/^Not sent: sound could not play/);
  await expect(page.getByRole('button', { name: 'Request medicine' })).toBeEnabled();
  await expectSoundLayout(page);
});
