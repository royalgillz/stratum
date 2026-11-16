import { expect, test } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

test('Listen tab offers relaying, on by default, and remembers the choice across a reload', async ({ page }) => {
  await page.goto('/src/phone/#listen', { waitUntil: 'domcontentloaded' });
  const box = page.getByRole('checkbox', { name: 'Pass on messages for others' });
  await expect(box).toBeChecked();
  await expect(page.getByRole('status').filter({ hasText: 'Passed on 0 messages this session · LIVE' })).toBeVisible();
  expect((await box.boundingBox())!.height, 'checkbox is not stretched to 44 px').toBeLessThan(30);
  await expect(page.getByText(/never decodes other families' messages/)).toBeVisible();
  await expectSoundLayout(page);

  await box.uncheck();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(box).not.toBeChecked();
  await expectSoundLayout(page);

  await box.check();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(box).toBeChecked();
});

test('the Listen tab counts each message this phone passes on', async ({ page }) => {
  // The app object is not reachable from a built page: remember whichever target gets a 'relayed' listener.
  await page.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: [EventListenerOrEventListenerObject | null, (boolean | AddEventListenerOptions)?]) {
      if (type === 'relayed') (window as unknown as { relayApp: EventTarget }).relayApp = this;
      return add.call(this, type, ...rest);
    };
  });
  await page.goto('/src/phone/#listen', { waitUntil: 'domcontentloaded' });
  const relay = () => page.evaluate(() => (window as unknown as { relayApp: EventTarget }).relayApp.dispatchEvent(new CustomEvent('relayed', { detail: new Uint8Array(1) })));
  await relay();
  await expect(page.getByRole('status').filter({ hasText: 'Passed on 1 message this session · LIVE' })).toBeVisible();
  await relay();
  await expect(page.getByText('Passed on 2 messages this session · LIVE')).toBeVisible();
  await expectSoundLayout(page);
});
