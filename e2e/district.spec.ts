import { expect, test, type Page } from '@playwright/test';
import { encode, TYPES } from '../src/core/packet/codec.ts';
import { deriveKeys, type KeySet } from '../src/core/packet/keys.ts';
import { expectSoundLayout } from './layout.ts';

const worldT = async (page: Page) => Number(await page.locator('#clock').getAttribute('data-t'));
const shownMetrics = (page: Page) => page.locator('#metrics td:nth-child(2)').allTextContents();

/** A real-codec OK, made here in Node as a phone makes it, under the given six words. */
async function okBytes(words: string, member: number, type: number = TYPES.OK, code = 0) {
  const keys = (await deriveKeys(words, 'family')) as KeySet;
  const bytes = await encode(keys, {
    type, minute: Math.floor(Date.now() / 60000), nonce: member * 1000 + code, hops: 3,
    payload: { member, code, level: 5, sector: 1, flags: 1, value: 0 },
  });
  return [...bytes];
}

test.describe('District 7 page', () => {
  test('reachable from the home page; the week plays and the switch shows the other rule at the same world time', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'District 7' }).click();
    await expect(page.getByRole('heading', { name: 'District 7', level: 1 })).toBeVisible();
    await expect(page.locator('#act')).toContainText('The network is down · TIME-LAPSE x3600 · paused', { timeout: 15_000 });
    await expect(page.locator('#clock')).toContainText('World time day 1, 00:00');
    await expect(page.locator('#clock')).toContainText('SIMULATED');
    await expect(page.locator('#map text')).not.toHaveCount(0);
    await expect(page.locator('#map')).toHaveAttribute('aria-label', /SIMULATED/);
    await expect(page.locator('#metrics tr')).toHaveCount(15); // one row per adapter, p01 to p15
    for (const row of await page.locator('#metrics th').allTextContents()) expect(row).toContain('SIMULATED');
    await expect(page.locator('#board')).toContainText('Nothing heard from this family yet');
    await expectSoundLayout(page);

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.locator('#act')).toHaveText('The network is down · TIME-LAPSE x3600');
    // One world hour per real second: by hour 8 the mesh and the bulletin have treated the separated families differently.
    await expect.poll(() => worldT(page), { timeout: 20_000 }).toBeGreaterThan(8 * 3600);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.locator('#act')).toContainText('paused');
    const t = await worldT(page), directorate = await shownMetrics(page);

    await page.getByRole('button', { name: 'STRATUM rule' }).click();
    await expect(page.getByRole('button', { name: 'STRATUM rule' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#shownHead')).toHaveText('STRATUM (shown)');
    expect(await worldT(page)).toBe(t);
    const stratum = await shownMetrics(page);
    expect(stratum).not.toEqual(directorate);
    expect(await page.locator('#metrics td:nth-child(3)').allTextContents()).toEqual(directorate); // the other rule, beside it
    await expectSoundLayout(page);

    await page.getByRole('button', { name: 'Sound: off' }).click();
    await expect(page.getByRole('button', { name: 'Sound: on' })).toBeVisible();
  });

  test('the week plays end to end: level 6 goes dark, the sag shows on the clock and in the hum, and a restart replays', async ({ page }) => {
    test.setTimeout(150_000);
    await page.addInitScript(() => { // every hum target the emitter sets, in order: f, 2f, then the gain
      const calls: number[] = [];
      Object.assign(window, { humCalls: calls });
      const set = AudioParam.prototype.setTargetAtTime;
      AudioParam.prototype.setTargetAtTime = function (v, t, c) { calls.push(v); return set.call(this, v, t, c); };
    });
    const hum = (n: number) => page.evaluate((n) => (window as unknown as { humCalls: number[] }).humCalls.slice(-n), n);
    await page.goto('/src/district/?speed=10', { waitUntil: 'domcontentloaded' }); // test knob: ten real seconds per second
    const cells = page.locator('#map g'), clock = page.locator('#clock');
    await expect(cells).toHaveCount(24, { timeout: 15_000 });
    await expect(page.locator('#map rect.demo')).toHaveCount(1);
    await expect(cells.nth(17).locator('rect.demo')).toHaveCount(1); // index (level - 1) * 4 + sector: level 5, B
    await expect(cells.nth(17).locator('title')).toContainText('Level 5 sector B, demo family');
    await expect(cells.nth(17)).toContainText('★');
    const vp = page.viewportSize()!;
    if (vp.width > 1000) { // two columns: the whole cross-section is on the first screen
      const box = (await page.locator('#map').boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    }

    await page.getByRole('button', { name: 'Sound: off' }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    // Checked in the page every frame: at ?speed these states last about a second, shorter than a Playwright poll under load.
    // The Directorate cuts the deepest level first: in the hour-30 shortfall level 6 C and D go dark.
    await page.waitForFunction(() => [...document.querySelectorAll('#map g')].flatMap((g, i) => (g.classList.contains('dark') ? [i] : [])).join() === '22,23',
      null, { polling: 'raf', timeout: 30_000 });
    // The audio clock sags inside the REAL TIME act; pause there, from the page, before the act can end.
    await page.waitForFunction(() => {
      const hit = document.getElementById('act')!.textContent === 'The hum sags: under a minute of warning, too short to count · REAL TIME'
        && /Hz, (AMBER|RED) /.test(document.getElementById('clock')!.textContent!);
      if (hit) document.getElementById('play')!.click();
      return hit;
    }, null, { polling: 'raf', timeout: 30_000 });
    const act = page.locator('#act');
    await expect(act).toContainText('The hum sags: under a minute of warning, too short to count · REAL TIME · paused');
    const f = Number(/grid ([\d.]+) Hz/.exec((await clock.textContent())!)![1]);
    expect(f).toBeLessThanOrEqual(399.95); // AMBER starts at f <= 399.95 (grid.ts), and the page pauses on its first frame
    const [f1, f2, gain] = await hum(3);
    expect(f1).toBeCloseTo(f, 2);
    expect(f2).toBeCloseTo(2 * f, 2);
    expect(gain).toBe(1);

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Week ended' })).toBeDisabled({ timeout: 120_000 });
    await expect(clock).toContainText('World time end of day 7 · ');
    await expect(page.locator('#act')).toHaveText('Week ended · press Restart to replay');
    await expectSoundLayout(page); // the week's longest figures
    await page.getByRole('button', { name: 'Sound: on' }).click();
    await expect.poll(async () => (await hum(1))[0]).toBe(0);

    await page.getByLabel('Seed').fill('2');
    await page.getByRole('button', { name: 'Restart' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();
    await expect(clock).toContainText('World time day 1, 00:00');
    await expect(clock).toContainText('seed 2');
    await expectSoundLayout(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: fifteen metrics by problem with direction, tier and label; the script switch restarts on the stress week`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/src/district/?speed=10', { waitUntil: 'domcontentloaded' });
      const rows = page.locator('#metrics tr');
      await expect(rows).toHaveCount(15, { timeout: 15_000 });
      const heads = await page.locator('#metrics th').allTextContents();
      heads.forEach((h, i) => {
        expect(h).toMatch(new RegExp(`^${i + 1}\\. `)); // grouped by problem number, 1 to 15
        expect(h).toMatch(/(higher|lower) is better/);
        expect(h).toMatch(/(Live|Modelled|Thin|Roadmap)/);
        expect(h).toContain('SIMULATED');
      });
      for (const r of await rows.all()) await expect(r.locator('.badge').first()).toBeVisible();
      await expect(page.locator('#metrics td')).toHaveCount(30); // both policies side by side
      await expect(page.locator('#metrics td', { hasText: 'not yet run' })).toHaveCount(0);
      await expect(page.locator('#map .surface')).toHaveText('Surface: no reading yet');
      await expect(page.locator('#metrics tr').nth(7).locator('td')).toHaveText(['not started', 'not started']); // no placeholder 0 h
      await expect(page.locator('#map rect.food-track')).toHaveCount(24);
      await expect(page.getByText('food store, bottom edge', { exact: false })).toBeVisible();
      await expect(page.getByRole('link', { name: 'coverage matrix' })).toHaveAttribute('href', './coverage.html');

      const seven = page.getByRole('button', { name: 'Seven-day week' }), stress = page.getByRole('button', { name: 'Stress week' });
      await expect(seven).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#scriptNote')).toContainText('Seven-day week');
      await page.getByRole('button', { name: 'Play' }).click();
      await expect.poll(() => worldT(page), { timeout: 20_000 }).toBeGreaterThan(3600);
      await stress.click();
      await expect(stress).toHaveAttribute('aria-pressed', 'true');
      await expect(seven).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#scriptNote')).toContainText('Stress week: built so STRATUM also loses.');
      await expect(page.locator('#act')).toContainText('A week below the floor');
      // Played to the end: the longest figures of the week must still fit every screen.
      await expect(page.getByRole('button', { name: 'Week ended' })).toBeDisabled({ timeout: 40_000 });
      await expect(page.locator('#metrics tr').nth(7).locator('td')).toHaveText(['no separations in this script', 'no separations in this script']);
      await expectSoundLayout(page);
      await page.getByRole('button', { name: 'STRATUM rule' }).click();
      await expect(page.locator('#map .surface')).toContainText("(crews' quorum)");
      await expectSoundLayout(page);
      await seven.click();
      await expect(seven).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#act')).toContainText(/The network is down|The hum sags/);
    });
  }

  test('a real-codec OK under the demo words reaches the board as LIVE under both rules; another family is rejected', async ({ page }) => {
    test.setTimeout(60_000);
    // ?test exposes only the seam after the microphone and modem: CI has no real microphone.
    await page.goto('/src/district/?test', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Family words')).toHaveValue('abandon ability able about above absent');
    await page.waitForFunction(() => 'districtTest' in window);
    await page.getByRole('button', { name: 'Play' }).click();

    const hear = (b: number[]) => page.evaluate((b) => (window as unknown as { districtTest: { hear(b: number[]): Promise<void> } }).districtTest.hear(b), b);
    await hear(await okBytes('abandon ability able about above absent', 42));
    await hear(await okBytes('zoo zone youth young yellow year', 43));
    const log = page.locator('#heard');
    await expect(log).toContainText('Verified OK from member 42 · LIVE');
    await expect(log).toContainText('Rejected: not this family (or damaged) · LIVE');
    await expect(log).not.toContainText(/[0-9a-f]{2} [0-9a-f]{2} [0-9a-f]{2}/); // never the bytes

    const board = page.locator('#board');
    await expect(board).toContainText('Member 42: I am OK, sent', { timeout: 10_000 });
    await expect(board).toContainText('level 5, sector B · LIVE');
    await expect(board).not.toContainText('Member 43');
    await page.getByRole('button', { name: 'STRATUM rule' }).click();
    await expect(board).toContainText('Member 42: I am OK, sent');
    await expect(board).toContainText('LIVE');
    // A Breath Count RED request from the same member: listed on the board too, while paused
    await page.getByRole('button', { name: 'Pause' }).click();
    await hear(await okBytes('abandon ability able about above absent', 42, TYPES.NEED, 0x10));
    await expect(log).toContainText('Verified NEED from member 42 · LIVE');
    await expect(board).toContainText('Member 42: Medicine request: Breath Count RED (danger sign), sent');
    await expectSoundLayout(page);
  });

  test('dark mode: the key text and a cut sector are visible, focus shows on the pressed rule button, the layout holds', async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/src/district/?speed=10', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
    await expect(page.locator('#map g')).toHaveCount(24, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Play' }).click();
    // Read in the page on the first frame with a cut sector: at ?speed it lasts about a second, and a pause can arrive after it.
    const cut = await page.waitForFunction(() => {
      const text = document.querySelector('#map g.dark text'), sump = document.querySelector('#map g.dark rect.sump');
      return text && sump && text.getBoundingClientRect().width > 0 && { fill: getComputedStyle(text).fill, sump: getComputedStyle(sump).stroke };
    }, null, { polling: 'raf', timeout: 30_000 }).then((h) => h.jsonValue());
    expect(cut).toEqual({ fill: 'rgb(238, 238, 238)', sump: 'rgb(238, 238, 238)' }); // light text, and the sump bar outlined to match
    await page.getByRole('button', { name: 'Pause' }).click();
    for (const el of [page.getByRole('heading', { name: 'District 7', level: 1 }), page.locator('#act'), page.locator('#clock'),
      page.getByText('L6', { exact: true }), page.getByText('power cut', { exact: true }), page.locator('#map g text').first(),
      page.locator('#metrics tr').first(), page.getByRole('button', { name: 'Directorate rule' })]) await expect(el).toBeVisible();

    await page.locator('#seed').focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab'); // Restart, Sound, then the pressed Directorate button
    const pressed = page.getByRole('button', { name: 'Directorate rule' });
    await expect(pressed).toBeFocused();
    await expect(pressed).toHaveCSS('outline-style', 'solid');
    await expect(pressed).toHaveCSS('outline-color', 'rgb(238, 238, 238)');
    await expectSoundLayout(page);
  });

  test('High Contrast: the pressed rule button keeps a frame, and focus still shows on it', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/src/district/', { waitUntil: 'domcontentloaded' });
    const pressed = page.getByRole('button', { name: 'Directorate rule' });
    await expect(pressed).toHaveAttribute('aria-pressed', 'true');
    await expect(pressed).toHaveCSS('outline-style', 'solid');
    await expect(pressed).toHaveCSS('outline-offset', '-6px');
    await page.locator('#seed').focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab'); // Restart, Sound, then the pressed Directorate button
    await expect(pressed).toBeFocused();
    await expect(pressed).toHaveCSS('outline-offset', '3px'); // the focus outline, outside the button
    await expect(pressed).toHaveCSS('border-top-width', '3px'); // the pressed frame, now on the border
    await expect(pressed).toHaveCSS('border-top-style', 'solid');
  });

  test('the gateway opens the microphone, and a wrong word says so', async ({ page }) => {
    await page.goto('/src/district/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Listen for phones' }).click();
    await expect(page.locator('#listenStatus')).toHaveText(/^Listening\./, { timeout: 15_000 });
    await page.getByLabel('Family words').fill('abandon ability able about above zzz');
    await page.getByLabel('Family words').press('Enter');
    await page.getByLabel('Family words').blur();
    await expect(page.locator('#wordsErr')).toHaveText('"zzz" is not one of the family words.');
    await expectSoundLayout(page);
  });
});
