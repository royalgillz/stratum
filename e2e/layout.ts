import { expect, type Page } from '@playwright/test';

/** Layout rules every page meets on every viewport (project UI rule). */
export async function expectSoundLayout(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal scroll').toBeLessThanOrEqual(0);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, select, input, a[href]')]
      .filter((el) => el.offsetParent !== null && !(el instanceof HTMLInputElement && el.type === 'checkbox'))
      .map((el) => ({ el: el.outerHTML.slice(0, 60), r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.height < 44 && !el.startsWith('<a')) // inline text links are exempt
      .map(({ el, r }) => `${el} ${Math.round(r.width)}x${Math.round(r.height)}`));
  expect(small, 'touch targets under 44 px').toEqual([]);
}
