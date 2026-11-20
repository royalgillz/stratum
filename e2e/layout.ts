import { expect, type Page } from '@playwright/test';

/** Layout rules every page meets on every viewport (project UI rule). */
export async function expectSoundLayout(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal scroll').toBeLessThanOrEqual(0);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, select, input, a[href]')]
      .filter((el) => el.offsetParent !== null)
      // A checkbox or radio is tapped through its label, so the label row is the target that must be 44 px.
      .map((el) => ({ el: el.outerHTML.slice(0, 60), r: ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio' ? el.closest('label') ?? el : el).getBoundingClientRect() }))
      .filter(({ el, r }) => r.height < 44 && !el.startsWith('<a')) // inline text links are exempt
      .map(({ el, r }) => `${el} ${Math.round(r.width)}x${Math.round(r.height)}`));
  expect(small, 'touch targets under 44 px').toEqual([]);
}

/** The QR code to the live phone page: shown with alt text and the address beside it, about 160 px, dark on white in both themes. */
export async function expectQr(page: Page) {
  const ADDR = 'stratum-nine-swart.vercel.app/src/phone/';
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const img = page.getByRole('img', { name: `QR code that opens the phone app at ${ADDR}` });
    await expect(img).toBeVisible();
    await expect(page.locator('.qr code')).toHaveText(ADDR);
    const s = await img.evaluate((e: HTMLImageElement) => ({ ok: e.complete && e.naturalWidth > 0, w: e.getBoundingClientRect().width, bg: getComputedStyle(e).backgroundColor }));
    expect(s.ok, 'the SVG loaded').toBe(true);
    expect(s.w).toBeGreaterThanOrEqual(150);
    expect(s.w).toBeLessThanOrEqual(180);
    expect(s.bg, 'white behind the code').toBe('rgb(255, 255, 255)');
    await expectSoundLayout(page);
  }
  await page.emulateMedia({ colorScheme: 'light' });
}
