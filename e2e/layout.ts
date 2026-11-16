import { expect, type Page } from '@playwright/test';

/** Layout rules every page meets on every viewport (CLAUDE.md UI rule). */
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
