import { expect, test, type Page } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

/** Keeps the app (whatever subscribes to 'reading') on window, so test readings and packets go through the real event path. */
async function hookApp(page: Page) {
  await page.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: [never, never]) {
      if (type === 'reading') (window as unknown as { testApp: EventTarget }).testApp = this;
      return add.call(this, type, ...rest);
    };
  });
}
const fire = (page: Page, type: 'reading' | 'packet', detail: object) =>
  page.evaluate(([type, detail]) => (window as unknown as { testApp: EventTarget }).testApp.dispatchEvent(new CustomEvent(type, { detail })), [type, detail] as const);
const reading = (tier?: string) => ({ t: 0, state: tier ? 'LIVE' : 'NO_HUM', snrDb: 20, label: 'LIVE', tier, deviationMHz: -60 });
/** A public "Power cut here" report from level 5, member m, sent now (by the page's clock). */
const cutReport = (page: Page, member: number) => page.evaluate((member) => {
  const decoded = { type: 2, hops: 3, minute: Math.floor(Date.now() / 60000), keySet: 'public', public: true, duplicate: false, timesHeard: 1,
    payload: { member, code: 0x10, level: 5, sector: 0, flags: 0, value: 0 } };
  (window as unknown as { testApp: EventTarget }).testApp.dispatchEvent(new CustomEvent('packet', { detail: { decoded, bytes: new Uint8Array(), at: Date.now() } }));
}, member);

test.describe('cut odds on the Listen tab', () => {
  test.beforeEach(async ({ page }) => {
    await hookApp(page);
    await page.clock.install();
    await page.goto('/src/phone/#report', { waitUntil: 'domcontentloaded' });
  });

  test('at AMBER with a level chosen, one line gives that level\'s odds from the Ledger; none at GREEN or with no level', async ({ page }) => {
    const odds = page.locator('#odds');
    await page.getByRole('tab', { name: 'Listen' }).click();
    await fire(page, 'reading', reading('AMBER'));
    await expect(page.locator('#tier')).toHaveText('▲ AMBER: WARNING, grid under strain');
    await expect(odds).toBeHidden(); // no level chosen yet
    await page.getByRole('tab', { name: 'Report' }).click();
    await page.locator('#level').selectOption('5');
    await page.getByRole('tab', { name: 'Listen' }).click();
    await fire(page, 'reading', reading('AMBER'));
    await expect(odds).toHaveText('Level 5: no data yet (needs reports from 3 phones)');
    await expectSoundLayout(page);
    for (const m of [1, 2, 3]) await cutReport(page, m); // three phones report level 5 dark during the event
    await fire(page, 'reading', reading('GREEN'));
    await expect(odds).toBeHidden();
    await page.clock.fastForward('11:00'); // the event closes 10 min after GREEN
    await fire(page, 'reading', reading('AMBER'));
    await expect(odds).toHaveText('Level 5: cut in 1 of 1 past AMBER event, odds 67% · LIVE');
    await fire(page, 'reading', reading('RED'));
    await expect(odds).toHaveText('Level 5: no data yet (needs reports from 3 phones)'); // the past event never reached RED
    await expectSoundLayout(page);
    await fire(page, 'reading', reading());
    await expect(odds).toBeHidden(); // NO HUM: no tier, no odds
  });
});

test.describe('ledger screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/phone/#ledger', { waitUntil: 'domcontentloaded' });
  });

  test('shows an empty state until the phone listens', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Ledger' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Odds of a power cut', exact: true })).toBeVisible();
    await expect(page.locator('#ledger-empty')).toContainText('Not listening');
    await expect(page.getByText('resets when the page reloads')).toBeVisible();
    await expect(page.locator('table.ledger')).toHaveCount(0);
    await expectSoundLayout(page);
    await page.getByRole('button', { name: 'Go to Listen' }).click();
    await expect(page.getByRole('tab', { name: 'Listen' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Listen' })).toBeFocused(); // not dropped to the page
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Start listening' })).toBeFocused(); // the URL fragment names no element
  });

  test('shows levels 1 to 6 with no data yet once listening, without horizontal scroll', async ({ page }) => {
    await page.getByRole('tab', { name: 'Listen' }).click();
    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.locator('#tier')).toHaveText(/NO HUM|Calibrating/, { timeout: 15_000 });
    await page.getByRole('tab', { name: 'Ledger' }).click();
    const table = page.locator('table.ledger');
    await expect(table.locator('caption')).toContainText('(LIVE)');
    await expect(table.locator('tbody tr')).toHaveCount(6);
    await expect(table.locator('tbody td', { hasText: 'no data yet' })).toHaveCount(12);
    await expect(table.getByRole('columnheader', { name: /AMBER/ })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /RED/ })).toBeVisible();
    await expect(page.getByText('anyone can send public reports')).toBeHidden(); // the caveats sit after the table, folded
    const table_top = (await table.boundingBox())!.y;
    expect(table_top, 'the table starts on the first screen').toBeLessThan(page.viewportSize()!.height);
    await page.getByText('How this is worked out').click();
    await expect(page.getByText('anyone can send public reports')).toBeVisible();
    await expectSoundLayout(page);
  });
});
