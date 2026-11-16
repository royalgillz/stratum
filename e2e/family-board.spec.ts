import { expect, test, type Page } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

// The app object is not on window. This test-only hook keeps a reference to whatever object
// subscribes to 'packet' (the app), so a fake heard packet can go through the real event path.
async function hookApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('stratum.member', '7'); // a fixed own member number, so counts are exact
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: [never, never]) {
      if (type === 'packet') (window as unknown as { testApp: EventTarget }).testApp = this;
      return add.call(this, type, ...rest);
    };
  });
}

/** A heard family packet: type 0 (OK) unless given, e.g. type 1 code 0x10 is a Breath Count RED request. */
const hear = (page: Page, member: number, minutesAgo: number, type = 0, code = 0, timesHeard = 1) =>
  page.evaluate(([member, minutesAgo, type, code, timesHeard]) => {
    const minute = Math.floor(Date.now() / 60000) - minutesAgo;
    const decoded = {
      type, hops: 3, minute, keySet: 'family', public: false, duplicate: timesHeard > 1, timesHeard,
      payload: { member, code, level: 3, sector: 1, flags: 0, value: 0 },
    };
    (window as unknown as { testApp: EventTarget }).testApp
      .dispatchEvent(new CustomEvent('packet', { detail: { decoded, bytes: new Uint8Array(), at: Date.now() } }));
  }, [member, minutesAgo, type, code, timesHeard]);

test.describe('family board', () => {
  test.beforeEach(async ({ page }) => {
    await hookApp(page);
    await page.clock.install(); // time runs normally; the staleness test fast-forwards it
    await page.goto('/src/phone/#family', { waitUntil: 'domcontentloaded' });
  });

  test('empty board asks for a family first, then says messages arrive only while the Listen tab is on', async ({ page }) => {
    const board = page.locator('#board');
    await expect(board).toContainText('You are member 7.');
    await expect(board).toContainText('Create or join a family above first.');
    await expect(board).not.toContainText('Nothing heard from your family yet');
    await expectSoundLayout(page);
    await page.getByRole('button', { name: 'Create a family' }).click();
    await expect(board).toContainText('Messages arrive only while the Listen tab is on');
    await expectSoundLayout(page);
  });

  test('shows heard members with staleness, and a local nickname', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a family' }).click();
    await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible();
    await hear(page, 201, 2);
    await hear(page, 202, 45);

    const board = page.locator('#board');
    await expect(board).toContainText('LIVE · 1 of 2 other members heard in the last 30 min');
    const rows = board.locator('li');
    await expect(rows.nth(0)).toContainText('⚠ Not heard for over 30 min'); // the one to worry about is on top
    await expect(rows.nth(0)).toContainText('Member 202');
    await expect(rows.nth(1)).toContainText('Member 201');
    await expect(rows.nth(1)).toContainText('LIVE · I am OK, sent');
    await expect(rows.nth(1)).toContainText('2 min ago · level 3, sector B · power off');
    await expectSoundLayout(page);

    page.once('dialog', (d) => void d.accept('Grandma'));
    await page.getByRole('button', { name: 'Nickname for member 202' }).click();
    await expect(rows.nth(0)).toContainText('Grandma (member 202)');
    await expect(page.getByRole('button', { name: 'Nickname for member 202' })).toBeFocused(); // the rebuild keeps focus
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible(); // rejoined from stored words
    await hear(page, 202, 1);
    await expect(page.locator('#board li').first()).toContainText('Grandma (member 202)');
    await expectSoundLayout(page);
  });

  test('marks you, says just now, and turns a row stale after 30 min with no new packet', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a family' }).click();
    await expect(page.getByRole('button', { name: 'Leave family' })).toBeVisible();
    await hear(page, 7, 0);
    await hear(page, 201, 0);

    const board = page.locator('#board');
    await expect(board).toContainText('LIVE · 1 of 1 other members heard in the last 30 min');
    await expect(board).toContainText('Member 7 (you)');
    await expect(page.getByRole('button', { name: 'Nickname for member 7' })).toHaveCount(0);
    await expect(board.locator('li').first()).toContainText('just now');
    await page.getByRole('button', { name: 'Nickname for member 201' }).focus();
    await expectSoundLayout(page);

    await page.clock.fastForward('31:30');
    await expect(board).toContainText('LIVE · 0 of 1 other members heard in the last 30 min');
    await expect(board.locator('li').first()).toContainText('⚠ Not heard for over 30 min');
    await expect(page.getByRole('button', { name: 'Nickname for member 201' })).toBeFocused(); // the 30 s tick keeps focus
    await expectSoundLayout(page);
  });
});

test.describe('family board and inbox wording', () => {
  test.beforeEach(async ({ page }) => {
    await hookApp(page);
    await page.goto('/src/phone/#family', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Create a family' }).click();
    await expect(page.locator('.words')).toBeFocused(); // the new words are read out
  });

  test('a RED medicine request shows RED on the board, with no power value', async ({ page }) => {
    await hear(page, 203, 5, 1, 0x10);
    const row = page.locator('#board li').first();
    await expect(row).toContainText('■ RED: medicine request (danger sign)');
    await expect(row).not.toContainText('Heard recently');
    await expect(row).not.toContainText('power');
    expect(await row.locator('.alert').evaluate((e) => getComputedStyle(e).fontWeight)).toBe('700');
    await expect(page.locator('#inbox li').first()).toContainText('■ RED: medicine request (danger sign) from member 203');
    await expectSoundLayout(page);
  });

  test('inbox rows are LIVE, in plain words, say "you", and a repeat updates its row', async ({ page }) => {
    const inbox = page.locator('#inbox');
    await expect(inbox).toHaveAttribute('role', 'log');
    await hear(page, 201, 0);
    await hear(page, 201, 0, 0, 0, 3);
    await hear(page, 7, 0, 1, 0x20);
    await expect(inbox.locator('li')).toHaveCount(2);
    await expect(inbox.locator('li').nth(0)).toHaveText(/^LIVE · .* · Needs help: Medicine from you · level 3, sector B$/);
    await expect(inbox.locator('li').nth(1)).toHaveText(/^LIVE · .* · I am OK from member 201 · level 3, sector B · power off · heard 3×$/);
    await expectSoundLayout(page);
  });
});
