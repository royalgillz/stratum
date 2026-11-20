import { expect, test } from '@playwright/test';
import { expectQr, expectSoundLayout } from './layout.ts';

test.describe('judge mode', () => {
  test('start screen lays out cleanly, reachable from the home page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Judge mode' }).click();
    await expect(page.getByRole('heading', { name: 'STRATUM judge mode' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play the 90-second story' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sound: on' })).toBeVisible();
    await expect(page.locator('#addr')).toHaveText(/\/src\/phone\/$/, { timeout: 15_000 }); // set by the module; the local server can be slow
    await expect(page.locator('#story')).toBeHidden();
    await expect(page.getByText('On a second phone (Android, in Chrome), scan the code or open the address, tap Listen, then Start listening.')).toBeVisible();
    await expectQr(page);
    await expect(page.locator('#next')).toBeHidden(); // the next step appears once the story ends
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light dark');
    await expectSoundLayout(page);
  });

  test('the drawn phone shows the REPLAY error line in the dark theme too', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/src/district/judge.html?speed=10', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Play the 90-second story' }).click();
    const line = page.locator('#replay');
    await expect(line).toBeVisible();
    await expect(line).toContainText('· REPLAY');
    expect(await line.evaluate((e) => getComputedStyle(e).color)).not.toBe(await page.evaluate(() => getComputedStyle(document.querySelector('.phone')!).backgroundColor));
    await expectSoundLayout(page);
  });

  test('the story runs the real tracker through CALIBRATING, GREEN, AMBER, RED, NO HUM and delivers an OK', async ({ page }) => {
    test.setTimeout(60_000);
    // speed=10 shortens the 90 s timeline to 9 s for this test only; the page labels it.
    await page.goto('/src/district/judge.html?speed=10', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#speedNote')).toContainText('TEST SPEED x10');
    await page.getByRole('button', { name: 'Sound: on' }).click();
    // The label says the state, so there is no aria-pressed to say it twice.
    await expect(page.getByRole('button', { name: 'Sound: muted' })).not.toHaveAttribute('aria-pressed');
    // Record the drawn phone's tier each time the caption changes, to check no caption runs ahead of it.
    await page.evaluate(() => {
      const seen: [string, string][] = ((window as unknown as { seen: [string, string][] }).seen = []);
      const cap = document.getElementById('caption')!, tier = document.getElementById('tier')!;
      new MutationObserver(() => seen.push([cap.textContent ?? '', tier.dataset.tier ?? ''])).observe(cap, { childList: true, characterData: true, subtree: true });
    });
    await page.getByRole('button', { name: 'Play the 90-second story' }).click();

    await expect(page.locator('#story')).toBeVisible();
    await expect(page.locator('#story')).toBeFocused(); // focus moves to the story, not to the page
    // The caption and the drawn phone's tier fit on one screen, so a phone user need not scroll.
    const vh = page.viewportSize()!.height;
    const inView = async (sel: string) => {
      const b = (await page.locator(sel).boundingBox())!;
      expect(b.y, `${sel} top`).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, `${sel} bottom`).toBeLessThanOrEqual(vh);
    };
    await inView('#caption');
    await inView('#tier');
    await expect(page.locator('#replay')).toHaveText(/^In a replay of \d+ recordings of a real 50 Hz grid, .* · REPLAY$/); // the Listen tab's REPLAY line
    await expect(page.getByText('LOOPBACK · SIMULATED')).toBeVisible();
    await expect(page.locator('#caption')).not.toBeEmpty();
    await expect(page.locator('#seq li').first()).toHaveText(/CALIBRATING/, { timeout: 10_000 });
    await expectSoundLayout(page);

    await expect(page.locator('#seq li')).toHaveText([/CALIBRATING/, /^● GREEN/, /^▲ AMBER/, /^■ RED/, /NO HUM/], { timeout: 30_000 });
    await expect(page.locator('#tier')).toHaveText('○ NO HUM');
    await inView('#tier'); // still on screen with the whole sequence listed
    await expect(page.locator('#dev')).toContainText('before a cut, not during one'); // stays while NO HUM; the caption moves on
    await expect(page.locator('#inbox')).toContainText('I am OK from family member 12', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Play the story again' })).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Play the story again' })).toBeFocused();
    const seen = await page.evaluate(() => (window as unknown as { seen: [string, string][] }).seen);
    for (const [caption, tier] of seen) {
      if (caption.includes('shows GREEN')) expect(tier, caption).toBe('GREEN');
      if (caption.includes('warns: AMBER')) expect(tier, caption).toBe('AMBER');
    }
    expect(seen.some(([c]) => c.includes('warns: AMBER'))).toBe(true);
    // The first 34 s carry the premise, not a blank wait, and claim no tier.
    expect(seen.some(([c, tier]) => c.startsWith('Where: the Hollow') && tier === 'CALIBRATING')).toBe(true);
    expect(seen.some(([c, tier]) => c.startsWith('Why sound') && tier === 'CALIBRATING')).toBe(true);
    // The story ends on the headline result, with its label and the stress-week loss, then points to the results.
    await expect(page.locator('#caption')).toContainText("STRATUM warned 40% of power cuts at least 10 minutes ahead; the Directorate's rule warned 0%. In the stress week both warn 0% · SIMULATED.");
    await expect(page.getByRole('link', { name: 'Next: the fifteen problems and results' })).toHaveAttribute('href', './coverage.html');
    await expect(page.locator('#seq li')).toHaveCount(5); // nothing flickered after the cut
    await expectSoundLayout(page);
  });
});
