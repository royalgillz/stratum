// Fan-stop alert on the Listen tab, driven through the page by a synthetic microphone:
// steady noise (the fan) over a faint floor (the room), then the fan stops.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

const STOPPED = 'FAN STOPPED: the air may stop moving. Check the fan and the vents, and move to moving air if you feel unwell. · LIVE';

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: a fan heard running, then stopped, raises the alert within 5 s`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => {
      const w = window as unknown as { fanStop(): void; mute(): void; buzz: unknown[] };
      w.buzz = [];
      Object.defineProperty(navigator, 'vibrate', { value: (p: unknown) => (w.buzz.push(p), true) });
      MediaDevices.prototype.getUserMedia = async () => {
        const c = new AudioContext();
        await c.resume();
        const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0, s = 1; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2; // fixed noise
        const noise = new AudioBufferSourceNode(c, { buffer: buf, loop: true });
        const fan = new GainNode(c, { gain: 1 }), room = new GainNode(c, { gain: 0.003 }); // the room 50 dB under the fan
        const out = c.createMediaStreamDestination();
        noise.connect(fan).connect(out);
        noise.connect(room).connect(out);
        noise.start();
        w.fanStop = () => { fan.gain.value = 0; };
        w.mute = () => { room.gain.value = 0; }; // digital silence, as from a muted microphone
        return out.stream;
      };
    });
    await page.goto('/src/phone/#listen', { waitUntil: 'domcontentloaded' });
    const fan = page.locator('#fan');
    await expect(fan).toBeEmpty();
    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(fan).toHaveText('Fan: listening for a steady fan · LIVE');
    await expect(fan).toHaveAttribute('role', 'status');
    await expect(fan).toHaveText('Fan: running · LIVE', { timeout: 30_000 });
    await expectSoundLayout(page);

    const stoppedAt = Date.now();
    await page.evaluate(() => (window as unknown as { fanStop(): void }).fanStop());
    await expect(fan).toHaveText(STOPPED, { timeout: 5_000 });
    expect(Date.now() - stoppedAt).toBeLessThanOrEqual(5_000);
    expect(await page.evaluate(() => (window as unknown as { buzz: unknown[] }).buzz)).toHaveLength(1);

    // The alert reads as an alert, fits the screen and keeps the hum line above it.
    const s = await fan.evaluate((e) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { right: r.right, weight: Number(cs.fontWeight), color: cs.color, bg: getComputedStyle(document.body).backgroundColor, below: document.getElementById('dev')!.getBoundingClientRect().bottom <= r.top };
    });
    expect(s.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(s.weight).toBeGreaterThanOrEqual(700);
    expect(s.color).not.toBe(s.bg);
    expect(s.below).toBe(true);
    await page.getByText('Fan test log').click();
    await expect(page.getByRole('button', { name: 'Save fan log' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save fan log' }).click();
    const csv = readFileSync(await (await download).path(), 'utf8').split('\n');
    expect(csv[0]).toBe('time,t_s,level_db,baseline_db,floor_db,running_db,steady,state');
    expect(csv.at(-1)).toMatch(/,STOPPED$/);
    await expectSoundLayout(page);

    // A muted microphone gives no readings: the line says so instead of keeping the old state.
    await page.evaluate(() => (window as unknown as { mute(): void }).mute());
    await expect(fan).toHaveText('Fan: no sound from the microphone. Check that it is not muted or in use by a call. · LIVE', { timeout: 5_000 });
    await expectSoundLayout(page);
  });
}

test('the in-world hum alone is not a fan, and a hum cut is not a fan stop', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const w = window as unknown as { humCut(): void };
    MediaDevices.prototype.getUserMedia = async () => {
      const c = new AudioContext();
      await c.resume();
      const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0, s = 1; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2;
      const noise = new AudioBufferSourceNode(c, { buffer: buf, loop: true });
      const room = new GainNode(c, { gain: 0.003 }), hum = new GainNode(c, { gain: 1 });
      const out = c.createMediaStreamDestination();
      noise.connect(room).connect(out);
      // The district's hum: 400 Hz and a stronger 800 Hz, far louder than the room.
      for (const [hz, gain] of [[400, 0.03], [800, 0.06]]) {
        const o = new OscillatorNode(c, { frequency: hz });
        o.connect(new GainNode(c, { gain })).connect(hum);
        o.start();
      }
      hum.connect(out);
      noise.start();
      w.humCut = () => { hum.gain.value = 0; };
      return out.stream;
    };
  });
  await page.goto('/src/phone/#listen', { waitUntil: 'domcontentloaded' });
  const fan = page.locator('#fan');
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(fan).toHaveText('Fan: listening for a steady fan · LIVE');
  await page.waitForTimeout(15_000); // past the 10 s a steady sound needs to count as a fan
  await page.evaluate(() => (window as unknown as { humCut(): void }).humCut());
  await page.waitForTimeout(6_000); // past the 5 s mark for a stop
  await expect(fan).toHaveText('Fan: listening for a steady fan · LIVE');
  await page.getByText('Fan test log').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save fan log' }).click();
  const rows = readFileSync(await (await download).path(), 'utf8').split('\n').slice(1);
  expect(rows.length).toBeGreaterThan(150);
  expect(new Set(rows.map((r) => r.split(',').at(-1)))).toEqual(new Set(['LISTENING']));
});
