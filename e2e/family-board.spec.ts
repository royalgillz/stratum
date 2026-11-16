import { expect, test, type Page } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

// The app object is not on window. This test-only hook keeps a reference to whatever object
// subscribes to 'packet' (the app), so a fake heard packet can go through the real event path.
async function hookApp(page: Page) {
  await page.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: [never, never]) {
      if (type === 'packet') (window as unknown as { testApp: EventTarget }).testApp = this;
      return add.call(this, type, ...rest);
    };
  });
}

const hear = (page: Page, member: number, minutesAgo: number) =>
  page.evaluate(([member, minutesAgo]) => {
    const minute = Math.floor(Date.now() / 60000) - minutesAgo;
    const decoded = {
      type: 0, hops: 3, minute, keySet: 'family', public: false, duplicate: false, timesHeard: 1,
      payload: { member, code: 0, level: 3, sector: 1, flags: 0, value: 0 },
    };
    (window as unknown as { testApp: EventTarget }).testApp
      .dispatchEvent(new CustomEvent('packet', { detail: { decoded, bytes: new Uint8Array(), at: Date.now() } }));
  }, [member, minutesAgo]);

test.describe('family board', () => {
  test.beforeEach(async ({ page }) => {
    await hookApp(page);
    await page.goto('/src/phone/#family', { waitUntil: 'domcontentloaded' });
  });

  test('empty board says messages arrive only while the Listen tab is on', async ({ page }) => {
    const board = page.locator('#board');
    await expect(board).toContainText(/You are member \d+\./);
    await expect(board).toContainText('Messages arrive only while the Listen tab is on');
    await expectSoundLayout(page);
  });

  test('shows heard members with staleness, and a local nickname', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a family' }).click();
    await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible();
    await hear(page, 201, 2);
    await hear(page, 202, 45);

    const board = page.locator('#board');
    await expect(board).toContainText(/1 of [23] members heard in the last 30 min/);
    const rows = board.locator('li');
    await expect(rows.nth(0)).toContainText('Member 201');
    await expect(rows.nth(0)).toContainText('2 min ago · level 3, sector B · power off');
    await expect(rows.nth(1)).toContainText('⚠ Not heard for over 30 min');
    await expectSoundLayout(page);

    page.once('dialog', (d) => void d.accept('Grandma'));
    await page.getByRole('button', { name: 'Nickname for member 202' }).click();
    await expect(rows.nth(1)).toContainText('Grandma (member 202)');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible(); // rejoined from stored words
    await hear(page, 202, 1);
    await expect(page.locator('#board li').first()).toContainText('Grandma (member 202)');
    await expectSoundLayout(page);
  });
});
