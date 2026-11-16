import { expect, test, type Page } from '@playwright/test';
import { CODEBOOK } from '../src/phone/codebook.ts';
import { expectSoundLayout } from './layout.ts';

/** Level and sector have no default (a guess would go on air as a false place): pick them as a user would. */
async function place(page: Page) {
  await page.locator('#level').selectOption('5');
  await page.locator('#sector').selectOption('A');
}

test('with no level and sector chosen, nothing can be sent and the dialog says why', async ({ page }) => {
  await page.goto('/src/phone/#report', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#level')).toHaveValue('');
  await page.getByRole('button', { name: 'Flooding or route blocked' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Choose your level and sector first');
  await expect(dlg.getByRole('button', { name: 'Send now' })).toBeHidden();
  await expectSoundLayout(page);
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  await place(page);
  await page.getByRole('button', { name: 'Flooding or route blocked' }).click();
  await expect(dlg).toContainText('Level 5, sector A, power on.');
  await expect(dlg.getByRole('button', { name: 'Send now' })).toBeVisible();
});

test.describe('report grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/phone/#report', { waitUntil: 'domcontentloaded' });
    await place(page);
  });

  test('shows every codebook button, grouped, without breaking the layout', async ({ page }) => {
    for (const h of ['OK', 'Need', 'Problems here']) await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
    for (const e of CODEBOOK) await expect(page.getByRole('button', { name: e.label, exact: true })).toBeVisible();
    await expectSoundLayout(page);
  });

  test('asks before sending, and Cancel sends nothing', async ({ page }) => {
    await page.getByRole('button', { name: 'Power cut here' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('cannot be called back');
    await expect(dlg).toContainText('power off');
    await expect(dlg.getByLabel('Everyone nearby')).toBeChecked();
    await expect(dlg.getByLabel('Family only')).toBeDisabled(); // no family yet
    await expect(dlg.getByLabel('How many people?')).toBeHidden();
    // A visible backdrop, and the disabled choice looks disabled (both were invisible in dark mode).
    expect(await page.locator('#confirm').evaluate((d) => getComputedStyle(d, '::backdrop').backgroundColor)).toBe('rgba(0, 0, 0, 0.6)');
    const color = (name: string) => dlg.locator('label', { hasText: name }).evaluate((l) => getComputedStyle(l).color);
    expect(await color('Family only')).not.toBe(await color('Everyone nearby'));
    await expectSoundLayout(page);
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.getByRole('status')).toHaveText('');
  });

  test('without a family, OK explains how to join and cannot be sent; public reports still go', async ({ page }) => {
    await page.getByRole('button', { name: 'I am OK' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('Family tab');
    await expect(dlg.getByRole('button', { name: 'Send now' })).toBeHidden();
    await expect(dlg.getByRole('button', { name: 'Go to Family tab' })).toBeVisible();
    await expect(dlg.getByLabel('How many people?')).toBeHidden();
    await expectSoundLayout(page);
    await dlg.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'People coughing or sick' }).click();
    await expect(dlg).toContainText('goes to everyone nearby');
    await expect(dlg.getByRole('button', { name: 'Go to Family tab' })).toBeHidden();
    await dlg.getByLabel('How many people?').fill('4');
    await dlg.getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByRole('button', { name: 'Medicine' })).toBeDisabled(); // sending state
    // The status stays on screen while the message is on air, even when the grid fills the viewport.
    const sent = page.locator('#sent');
    await expect(sent).toContainText('keep the phone still');
    const box = (await sent.boundingBox())!, vh = page.viewportSize()!.height;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(vh);
    await expectSoundLayout(page);
    await expect(page.getByRole('status')).toContainText('Sent "People coughing or sick" to everyone nearby', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Medicine' })).toBeEnabled();
  });

  test('with a family, a need goes to the family by default', async ({ page }) => {
    await page.getByRole('tab', { name: 'Family' }).click();
    await page.getByRole('button', { name: 'Create a family' }).click();
    await page.getByRole('tab', { name: 'Report' }).click();
    await page.getByRole('button', { name: 'Medicine' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('Level 5, sector A.'); // a need carries no power state
    await expect(dlg).not.toContainText('power');
    await expect(dlg.getByLabel('Family only')).toBeChecked();
    await expect(dlg.getByLabel('Everyone nearby')).toBeEnabled();
    await expectSoundLayout(page);
    await dlg.getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByRole('status')).toContainText('Sent "Medicine" to your family', { timeout: 15_000 });

    await page.getByRole('button', { name: 'I am OK' }).click();
    await expect(dlg).toContainText('Goes to your family only.');
    await expect(dlg.getByLabel('How many people?')).toBeHidden();
    await expectSoundLayout(page);
    await dlg.getByRole('button', { name: 'Cancel' }).click();
  });

  test('after a power cut is sent, the power box shows off and focus returns to the grid', async ({ page }) => {
    const box = page.getByLabel('Power on here');
    await expect(box).toBeChecked();
    await page.getByRole('button', { name: 'Power cut here' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByRole('status')).toContainText('Sent "Power cut here"', { timeout: 15_000 });
    await expect(box).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Power cut here' })).toBeFocused();
    await expectSoundLayout(page);
  });

  test('when the browser blocks sound, the send fails clearly and the grid comes back', async ({ page }) => {
    await page.addInitScript(() => { AudioContext.prototype.resume = () => new Promise(() => {}); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Water looks wrong' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByRole('status')).toContainText('Not sent: sound is blocked', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Medicine' })).toBeEnabled();
    await expectSoundLayout(page);
  });
});
