// Vibration and screen-reader announcements on the phone (src/phone/alerts.ts), driven through the app's real events.
import { expect, test, type Page } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

/** Keeps the app on window and records every navigator.vibrate call. */
async function hookApp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { testApp: EventTarget; buzz: unknown[] };
    w.buzz = [];
    Object.defineProperty(navigator, 'vibrate', { value: (p: unknown) => (w.buzz.push(p), true) });
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: [never, never]) {
      if (type === 'reading') w.testApp = this;
      return add.call(this, type, ...rest);
    };
  });
}
const fire = (page: Page, type: 'reading' | 'packet', detail: object) =>
  page.evaluate(([type, detail]) => (window as unknown as { testApp: EventTarget }).testApp.dispatchEvent(new CustomEvent(type, { detail })), [type, detail] as const);
const reading = (tier: string) => ({ t: 0, state: 'LIVE', snrDb: 20, label: 'LIVE', tier, deviationMHz: -60 });
const buzz = (page: Page) => page.evaluate(() => (window as unknown as { buzz: unknown[] }).buzz);
const AMBER = [700], RED = [150, 100, 150, 100, 150, 250, 500, 150, 500, 150, 500], MESSAGE = [200, 150, 200];

test.describe('alerts beyond the screen', () => {
  test.beforeEach(async ({ page }) => {
    await hookApp(page);
    await page.goto('/src/phone/#listen', { waitUntil: 'domcontentloaded' });
  });

  test('buzzes its own pattern at AMBER and at RED, only on a change, and announces on any tab', async ({ page }) => {
    const box = page.getByRole('checkbox', { name: 'Vibrate on alerts' });
    await expect(box).toBeChecked();
    await expectSoundLayout(page);
    for (const t of ['GREEN', 'AMBER', 'AMBER', 'RED', 'RED']) await fire(page, 'reading', reading(t));
    await expect(page.locator('#tier')).toHaveText('■ RED: DANGER, cut likely soon');
    expect(await buzz(page)).toEqual([AMBER, RED]);
    await expect(page.locator('#alertNow')).toHaveText('■ RED: DANGER, cut likely soon'); // assertive: says it even over #tier
    await expect(page.locator('#alertSoon')).toBeEmpty(); // AMBER was already said by #tier on the open Listen tab
    // RED repeats until Seen: the banner holds a 44 px Seen button; the flash never takes a tap.
    const seen = page.getByRole('button', { name: 'Seen' });
    await expect(page.locator('#alertBanner')).toBeVisible();
    expect((await seen.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#flash')).toHaveCSS('pointer-events', 'none');
    await seen.click();
    await expect(page.locator('#alertBanner')).toBeHidden();

    // On another tab the Listen tab's live region is hidden and silent: the page-wide one speaks.
    await page.getByRole('tab', { name: 'Report' }).click();
    await fire(page, 'reading', reading('GREEN'));
    await fire(page, 'reading', reading('AMBER'));
    await expect(page.locator('#alertSoon')).toHaveText('▲ AMBER: WARNING, grid under strain');
    expect(await buzz(page)).toEqual([AMBER, RED, AMBER]);
  });

  test('a public water alert buzzes once and is announced; the setting turns buzzing off and is kept', async ({ page }) => {
    const alert = { type: 5, hops: 3, minute: Math.floor(Date.now() / 60000), keySet: 'public', public: true, duplicate: false, timesHeard: 1,
      payload: { member: 9, code: 0x30, level: 5, sector: 0, flags: 0, value: 0 } };
    await fire(page, 'packet', { decoded: alert, bytes: [], at: Date.now() });
    // Said as the inbox row says it: LIVE label and sender count, so a forgeable alert is never stated as fact.
    await expect(page.locator('#alertSoon')).toHaveText(/^Public alert: LIVE · .*⚠ Water looks or smells wrong: hold, do not drink from member 9 .* · public · 1 sender, unconfirmed$/);
    await fire(page, 'packet', { decoded: { ...alert, duplicate: true, timesHeard: 2 }, bytes: [], at: Date.now() }); // a relayed copy
    expect(await buzz(page)).toEqual([MESSAGE]);
    // A second sender of the same alert at the same place is announced, but does not buzz again.
    await fire(page, 'packet', { decoded: { ...alert, payload: { ...alert.payload, member: 10 } }, bytes: [], at: Date.now() });
    await expect(page.locator('#alertSoon')).toHaveText(/ · 2 senders, unconfirmed$/);
    expect(await buzz(page)).toEqual([MESSAGE]);

    await page.getByRole('checkbox', { name: 'Vibrate on alerts' }).uncheck();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('checkbox', { name: 'Vibrate on alerts' })).not.toBeChecked();
    await fire(page, 'reading', reading('RED'));
    await expect(page.locator('#alertNow')).toHaveText('■ RED: DANGER, cut likely soon'); // still announced
    expect(await buzz(page)).toEqual([]);
  });
});
