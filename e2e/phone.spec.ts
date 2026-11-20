import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectQr, expectSoundLayout } from './layout.ts';

const VISIBLE_TABS = [
  ['Listen', 'Listen to the grid'],
  ['Report', 'Report'],
  ['Family', 'Family'],
  ['Ledger', 'Odds of a power cut'],
  ['Care', 'Breath Count'],
] as const;

// The committed REPLAY figures (npm run score:enf), read from disk so the screen is checked against the evidence, not against itself.
const enfAll = JSON.parse(readFileSync('public/evidence/enf-whu.json', 'utf8')), enf = enfAll.withHum, cm = enf.clipMedians, tiers = enfAll.tiers.absolute;

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

  test('a judge alone is told where the hum comes from, and the main actions stand out', async ({ page }) => {
    // The tracker follows the Hollow's 400 Hz grid: a normal room never has it, so the page points to judge mode.
    await expect(page.getByText("Listens for the Hollow's 400 Hz grid hum")).toBeVisible();
    await expect(page.getByText('Alone? Try the Care tab.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'judge mode' }).first()).toHaveAttribute('href', '/src/district/judge.html');
    // The laptop hint shows only on a wide screen, where a judge has opened the phone page by mistake.
    await expect(page.getByText('On a laptop?')).toBeVisible({ visible: page.viewportSize()!.width >= 900 });
    // Start listening and Create a family carry the accent fill, as judge mode's Play does.
    const fill = (name: string) => page.getByRole('button', { name }).evaluate((e) => {
      const s = getComputedStyle(e);
      return { bg: s.backgroundColor, fg: s.color, bodyBg: getComputedStyle(document.body).backgroundColor };
    });
    const listen = await fill('Start listening');
    await page.getByRole('tab', { name: 'Family' }).click();
    for (const b of [listen, await fill('Create a family')]) {
      expect(b.bg, 'accent fill').not.toBe('rgba(0, 0, 0, 0)');
      expect(b.fg, 'text on the fill is the page background').toBe(b.bodyBg);
    }
    await expectSoundLayout(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`Listen shows the tracker's REPLAY error on real recordings, small and readable (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const line = page.locator('#replay');
      await expect(line).toBeVisible();
      await expect(line).toHaveText(`Checked on ${enf.clips} recordings of a real grid: typically ${Math.round(cm.medianMHz)} mHz off · REPLAY`); // one line; the rest one tap away
      const s = await line.evaluate((e) => {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        return { size: parseFloat(cs.fontSize), right: r.right, color: cs.color, bg: getComputedStyle(document.body).backgroundColor, tier: parseFloat(getComputedStyle(document.getElementById('tier')!).fontSize) };
      });
      expect(s.size).toBeGreaterThanOrEqual(14); // readable on the fold cover
      expect(s.size).toBeLessThanOrEqual(s.tier); // the tier stays the main thing
      expect(s.right).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(s.color).not.toBe(s.bg);
      // Both medians the evidence file asks for, with their clip counts, one tap away.
      await page.getByText('How sure is this?').click();
      const more = page.locator('#replayMore');
      await expect(more.locator('p').first()).toBeVisible();
      await expect(more).toContainText(`In a replay of ${enf.clips} recordings of a real 50 Hz grid, the tracker was typically ${Math.round(cm.medianMHz)} mHz off; ${Math.round((100 * cm.over500) / cm.clips)}% of the ${cm.clips} scored followed another hum instead · REPLAY`);
      await expect(more).toContainText(`replayed ${enf.clips} recordings of a real 50 Hz grid`);
      await expect(more).toContainText(`each recording's median error: ${cm.medianMHz} mHz (${cm.clips} recordings; ${enf.clips - cm.clips} gave no reading)`);
      await expect(more).toContainText(`all ${enf.scored.toLocaleString('en-US')} readings pooled: ${enf.medianMHz} mHz`);
      await expect(more).toContainText(`${cm.over500} of the ${cm.clips} recordings were off by over 500 mHz`);
      // The tiers on the real grid: false warnings and misses, with how much was checked
      await expect(more).toContainText(`Warnings, checked the same way over ${tiers.comparedHours} hours of tiers from ${tiers.clipsCompared} recordings: while the real grid stayed GREEN, the tracker showed AMBER or RED on ${(100 * tiers.falseAlarmShare).toFixed(1)}% of readings, ${tiers.falseEntriesPerHour} false warnings an hour; it showed GREEN on ${(100 * tiers.missShare).toFixed(1)}% of readings where the real grid was AMBER or RED.`);
      await expect(more).toContainText('The grid here runs at 400 Hz, not 50 Hz, so take these figures as a guide · REPLAY');
      await expectSoundLayout(page);
    });
  }

  for (const [name, setup, says] of [
    ['refused', () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); }, 'Microphone permission was refused'],
    ['not https', () => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined }); }, 'must be opened over https'],
    ['worklet gone after an update', () => { AudioWorklet.prototype.addModule = () => Promise.reject(new DOMException('Unable to load a worklet', 'AbortError')); }, 'STRATUM was updated: reload the page to listen.'],
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

test('home page says where and what STRATUM is, judge mode first, one result with its loss and the device test, spikes tucked away', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('In the Hollow, a city underground')).toBeVisible();
  await expect(page.getByText('hears the grid weaken before a power cut')).toBeVisible();
  await expect(page.getByText('Rung 0')).toHaveCount(0);
  // Every number keeps its label, and the loss sits beside the win.
  await expect(page.locator('.facts li').nth(0)).toContainText(/STRATUM 40% vs Directorate 0%.*STRATUM 85% vs Directorate 66%.*20 seeds · SIMULATED$/);
  await expect(page.locator('.facts li').nth(1)).toHaveText('Against us: in the stress week the warning gain is gone, STRATUM 0% vs Directorate 0% · SIMULATED');
  // The caveats on the big numbers are not set smaller than the page's body text
  const [note, body] = await page.locator('.facts .lead .caveat').evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(document.body).fontSize]);
  expect(parseFloat(note)).toBeGreaterThanOrEqual(parseFloat(body));
  await expect(page.locator('.facts li').nth(2)).toContainText(/^Tested on a real phone \(Galaxy Z Fold 7, Nov 19 2026\).* · LIVE$/);
  await expect(page.locator('.facts li').nth(3)).toContainText(/^Care: a decision aid, not a medical device, for children under five\..* · LIVE/);
  await expect(page.getByText('One loop, all fifteen problems')).toBeVisible();
  const links = page.locator('a:visible');
  await expect(links).toHaveText(['Start here: Judge mode', 'Coverage matrix', 'Phone app', 'District 7']);
  // The way in is the filled button at the top of the first screen.
  const start = await links.first().evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, bottom: e.getBoundingClientRect().bottom }));
  expect(start.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(start.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
  for (const a of await links.all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expectQr(page);
  const qr = (await page.getByRole('img', { name: /^QR code/ }).boundingBox())!, phone = (await page.getByRole('link', { name: 'Phone app' }).boundingBox())!;
  expect(qr.y - (phone.y + phone.height), 'the QR code sits by the Phone app link').toBeLessThan(120);
  await expect(page.getByRole('link', { name: 'Emitter' })).toBeHidden();
  await page.getByText('Developer spikes').click();
  await expect(page.getByRole('link', { name: 'Emitter' })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light dark');
  await expectSoundLayout(page);
});
