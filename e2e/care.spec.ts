import { expect, test, type Page } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

const DISCLAIMER = /Decision aid, not a medical device/;

async function choose(page: Page, years: string, months = '0', cough = 'Yes') {
  await page.getByLabel('Years').selectOption(years);
  if (years === '5') return; // months and the questions do not apply
  await page.getByLabel('Months').selectOption(months);
  await page.getByRole('radio', { name: cough }).check();
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
    await expect(page.getByLabel('Months')).toBeHidden(); // changes nothing at five or older
    await expect(page.getByRole('note')).toBeVisible();
    await expectSoundLayout(page);
  });

  test('before question 2 is answered, a greyed Start says why; months are optional from 1 year', async ({ page }) => {
    await page.getByLabel('Years').selectOption('2');
    await expect(page.getByLabel('Months').locator('option').first()).toHaveText('Optional');
    const start = page.getByRole('button', { name: 'Start 60-second count' });
    await expect(start).toBeDisabled();
    await expect(start).toHaveAccessibleDescription(/Answer question 2 first/);
    await expect(page.locator('#startWhy')).toBeVisible();
    await expectSoundLayout(page);
    await page.getByRole('radio', { name: 'Yes' }).check();
    await expect(page.locator('#startWhy')).toBeHidden();
    await expect(start).toBeEnabled();
  });

  test('the tap target is at least 120 px tall, with countdown, tap count and Stop', async ({ page }) => {
    await choose(page, '2');
    await page.getByRole('button', { name: 'Start 60-second count' }).click();
    await expect(page.getByRole('button', { name: 'Start 60-second count' })).toBeHidden(); // no second control above the tap target
    await expect(page.locator('.count')).toContainText('· LIVE');
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
    await expect(page.locator('#result')).toBeFocused();
    await expect(page.locator('#announce')).not.toContainText('RECOUNT'); // the focused card reads it once
  });

  test('answering No to cough mid-count stops the count and discards it', async ({ page }) => {
    await choose(page, '1');
    await page.getByRole('button', { name: 'Start 60-second count' }).click();
    await page.getByRole('button', { name: 'Tap once per breath' }).click();
    await page.getByRole('radio', { name: 'No' }).check();
    await expect(page.locator('#counter')).toBeHidden();
    await expect(page.locator('#result')).toContainText('NOT ASSESSED');
    await page.clock.runFor(61_000);
    await expect(page.locator('#result')).not.toBeFocused(); // no timer left to finish
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
      await expect(result).not.toContainText('Decision aid'); // the disclaimer above says it once
      await expect(page.getByRole('button', { name: 'Count again' })).toBeVisible();
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
    await expect(page.locator('#result')).toContainText('REFER: see a health worker');
    // An urgent instruction: red like a danger card, not grey like a neutral one.
    const [border, head] = await page.locator('#result').evaluate((e) => [getComputedStyle(e).borderTopColor, getComputedStyle(e.querySelector('.head')!).color]);
    expect(border).toBe(head); // both var(--red); a neutral card has a grey border and plain text
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
    await expect(result).toContainText('Rate: no full minute counted yet (fast is');
    await expect(page.getByRole('button', { name: 'Request medicine' })).toBeVisible();
    await expect(page.locator('#careWhere')).toHaveText('Choose your level and sector on the Report tab first.'); // no guessed place
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
    await expect(page.getByRole('button', { name: 'Start 60-second count' })).toBeHidden(); // no count step for no cough
    await expectSoundLayout(page);
  });

  test('a request with no family is marked as not sent and offers the Family tab', async ({ page }) => {
    await page.getByLabel('Years').selectOption('2');
    await page.getByLabel('Convulsions (fits)').check();
    await page.getByRole('button', { name: 'Request medicine' }).click();
    await expect(page.locator('#careSent')).toHaveClass('err');
    await expect(page.locator('#careSent')).toContainText('Join a family first');
    await expectSoundLayout(page);
    await page.getByRole('button', { name: 'Go to Family tab' }).click();
    await expect(page.getByRole('tab', { name: 'Family' })).toHaveAttribute('aria-selected', 'true');
  });
});

test('a send that cannot play says it was not sent', async ({ page }) => {
  await page.addInitScript(() => {
    (window as { AudioContext: unknown }).AudioContext = class { constructor() { throw new Error('audio blocked'); } };
  });
  await page.goto('/src/phone/#report', { waitUntil: 'domcontentloaded' });
  await page.locator('#level').selectOption('2');
  await page.locator('#sector').selectOption('C');
  await page.getByRole('tab', { name: 'Family' }).click();
  await page.getByRole('button', { name: 'Create a family' }).click();
  await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible();
  await page.getByRole('tab', { name: 'Care' }).click();
  await page.getByLabel('Years').selectOption('2');
  await page.getByLabel('Convulsions (fits)').check();
  await expect(page.locator('#careWhere')).toHaveText('Sends for level 2, sector C (change on the Report tab).');
  await page.getByRole('button', { name: 'Request medicine' }).click();
  await expect(page.locator('#careSent')).toHaveText(/^Not sent: sound could not play/);
  await expect(page.getByRole('button', { name: 'Request medicine' })).toBeEnabled();
  await expectSoundLayout(page);
});
