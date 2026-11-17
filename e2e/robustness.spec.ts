// Failure paths the happy-path specs do not reach: blocked storage, blocked sound, a stale worklet,
// two sends at once, and a phone OK heard while the district week is paused.
import { expect, test, type Page } from '@playwright/test';
import { encode, TYPES } from '../src/core/packet/codec.ts';
import { deriveKeys, type KeySet } from '../src/core/packet/keys.ts';
import { expectSoundLayout } from './layout.ts';

async function familyAndPlace(page: Page) {
  await page.goto('/src/phone/#report', { waitUntil: 'domcontentloaded' });
  await page.locator('#level').selectOption('3');
  await page.locator('#sector').selectOption('B');
  await page.getByRole('tab', { name: 'Family' }).click();
  await page.getByRole('button', { name: 'Create a family' }).click();
  await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible();
  await page.getByRole('tab', { name: 'Care' }).click();
  await page.getByLabel('Years').selectOption('2');
  await page.getByLabel('Convulsions (fits)').check();
}

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: with storage blocked, Care sends for the place chosen on Report`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
    await familyAndPlace(page);
    await expect(page.locator('#careWhere')).toHaveText('Sends for level 3, sector B (change on the Report tab).');
    await page.getByRole('button', { name: 'Request medicine' }).click();
    await expect(page.locator('#careSent')).toContainText('Medicine request sent to your family', { timeout: 15_000 });
    await expectSoundLayout(page);
  });

  test(`${scheme}: when the browser blocks sound, Request medicine says not sent and comes back`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => { AudioContext.prototype.resume = () => new Promise(() => {}); });
    await familyAndPlace(page);
    await page.getByRole('button', { name: 'Request medicine' }).click();
    await expect(page.locator('#careSent')).toHaveText(/^Not sent: sound could not play/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Request medicine' })).toBeEnabled();
    await expectSoundLayout(page);
  });
}

test('one phone plays one packet at a time: a Care request waits for a Report send', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const w = window as unknown as { onAir: [number, number][] };
    w.onAir = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...a: Parameters<typeof start>) {
      const t = this.context.currentTime;
      w.onAir.push([t, t + this.buffer!.duration]);
      return start.apply(this, a);
    };
  });
  await familyAndPlace(page);
  await page.getByRole('tab', { name: 'Report' }).click();
  await page.getByRole('button', { name: 'Power cut here' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send now' }).click();
  await expect(page.locator('#sent')).toContainText('Sending');
  await page.getByRole('tab', { name: 'Care' }).click();
  await page.getByRole('button', { name: 'Request medicine' }).click();
  await expect(page.locator('#careSent')).toContainText('Medicine request sent to your family', { timeout: 20_000 });
  const onAir = await page.evaluate(() => (window as unknown as { onAir: [number, number][] }).onAir);
  expect(onAir).toHaveLength(2);
  expect(onAir[1][0]).toBeGreaterThanOrEqual(onAir[0][1] - 0.05); // the second starts once the first has ended
});

for (const [path, button] of [['/src/phone/#listen', 'Start listening'], ['/src/district/', 'Listen for phones']]) {
  test(`a stale worklet leaves no microphone open (${path})`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { streams: MediaStream[] };
      w.streams = [];
      AudioWorklet.prototype.addModule = () => Promise.reject(new Error('gone'));
      const gum = MediaDevices.prototype.getUserMedia;
      MediaDevices.prototype.getUserMedia = async function (this: MediaDevices, c?: MediaStreamConstraints) {
        const s = await gum.call(this, c);
        w.streams.push(s);
        return s;
      };
    });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: button }).click();
      await expect(page.getByText('STRATUM was updated: reload the page to listen.')).toBeVisible();
    }
    const live = await page.evaluate(() => (window as unknown as { streams: MediaStream[] }).streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);
    expect(live).toBe(0);
  });
}

test('a phone OK heard while the week is paused is on the board at once, and stays after Restart', async ({ page }) => {
  await page.goto('/src/district/?test', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => 'districtTest' in window);
  const keys = (await deriveKeys('abandon ability able about above absent', 'family')) as KeySet;
  const bytes = await encode(keys, {
    type: TYPES.OK, minute: Math.floor(Date.now() / 60000), nonce: 4242, hops: 3,
    payload: { member: 42, code: 0, level: 5, sector: 1, flags: 1, value: 0 },
  });
  await page.evaluate((b) => (window as unknown as { districtTest: { hear(b: number[]): Promise<void> } }).districtTest.hear(b), [...bytes]);
  const board = page.locator('#board');
  await expect(page.locator('#act')).toContainText('paused');
  await expect(board).toContainText('Member 42: I am OK, sent');
  await expect(board).toContainText('level 5, sector B · LIVE');
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.getByRole('button', { name: 'STRATUM rule' }).click();
  await expect(board).toContainText('Member 42: I am OK, sent');
});
