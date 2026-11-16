import { expect, test } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

test.describe('judge mode', () => {
  test('start screen lays out cleanly, reachable from the home page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Judge mode' }).click();
    await expect(page.getByRole('heading', { name: 'STRATUM judge mode' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play the 90-second story' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sound: on' })).toBeVisible();
    await expect(page.locator('#addr')).toHaveText(/\/src\/phone\/$/, { timeout: 15_000 }); // set by the module; the local server can be slow
    await expect(page.locator('#story')).toBeHidden();
    await expectSoundLayout(page);
  });

  test('the story runs the real tracker through CALIBRATING, GREEN, AMBER, RED, NO HUM and delivers an OK', async ({ page }) => {
    test.setTimeout(60_000);
    // speed=10 shortens the 90 s timeline to 9 s for this test only; the page labels it.
    await page.goto('/src/district/judge.html?speed=10', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#speedNote')).toContainText('TEST SPEED x10');
    await page.getByRole('button', { name: 'Sound: on' }).click();
    await expect(page.getByRole('button', { name: 'Sound: muted' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Play the 90-second story' }).click();

    await expect(page.locator('#story')).toBeVisible();
    await expect(page.getByText('LOOPBACK · SIMULATED')).toBeVisible();
    await expect(page.locator('#caption')).not.toBeEmpty();
    await expect(page.locator('#seq li').first()).toHaveText('CALIBRATING', { timeout: 10_000 });
    await expectSoundLayout(page);

    await expect(page.locator('#seq li')).toHaveText(['CALIBRATING', 'GREEN', 'AMBER', 'RED', 'NO HUM'], { timeout: 30_000 });
    await expect(page.locator('#dev')).toContainText('before a cut, not during one'); // stays while NO HUM; the caption moves on
    await expect(page.locator('#inbox')).toContainText('OK from member 12', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Play the story again' })).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator('#seq li')).toHaveCount(5); // nothing flickered after the cut
    await expectSoundLayout(page);
  });
});
