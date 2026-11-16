import { expect, test } from '@playwright/test';
import { CODEBOOK } from '../src/phone/codebook.ts';
import { expectSoundLayout } from './layout.ts';

test.describe('report grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/phone/#report', { waitUntil: 'domcontentloaded' });
  });

  test('shows every codebook button, grouped, without breaking the layout', async ({ page }) => {
    for (const h of ['OK', 'Need', 'Report here']) await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
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
    await expect(dlg.getByLabel('How many people?')).toBeHidden();
    await expectSoundLayout(page);
    await dlg.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'People coughing or sick' }).click();
    await expect(dlg).toContainText('goes to everyone nearby');
    await dlg.getByLabel('How many people?').fill('4');
    await dlg.getByRole('button', { name: 'Send now' }).click();
    await expect(page.getByRole('button', { name: 'Medicine' })).toBeDisabled(); // sending state
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
