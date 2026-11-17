import { expect, test, type Page } from '@playwright/test';
import { expectSoundLayout } from './layout.ts';

// The Hollow has no network: after one visit online, every page must open and run from the service worker's cache.
test.use({ serviceWorkers: 'allow' });

/** First visit online until the service worker controls the page (precache done), then reload with no network. */
async function reloadOffline(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`phone page, ${scheme}: offline after one visit, five tabs and Listen work`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await reloadOffline(page, '/src/phone/');
    for (const [tab, heading] of [['Report', 'Report'], ['Family', 'Family'], ['Ledger', 'Odds of a power cut'], ['Care', 'Breath Count'], ['Listen', 'Listen to the grid']]) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Start listening' }).click(); // worklet and ggwave come from the cache
    await expect(page.locator('#tier')).toHaveText(/NO HUM|Calibrating/, { timeout: 15_000 });
    await expectSoundLayout(page);
  });
}

test('District 7 offline after one visit: Play runs the simulation, the coverage matrix loads its evidence', async ({ page }) => {
  test.setTimeout(60_000);
  await reloadOffline(page, '/src/district/');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(async () => Number(await page.locator('#clock').getAttribute('data-t')), { timeout: 20_000 }).toBeGreaterThan(3600);
  await page.goto('/src/district/coverage.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#matrix > li')).toHaveCount(15, { timeout: 15_000 });
  await expect(page.locator('#status')).toHaveText('');
});

test('judge mode offline after one visit: the story plays', async ({ page }) => {
  await reloadOffline(page, '/src/district/judge.html?speed=10');
  await page.getByRole('button', { name: 'Play the 90-second story' }).click();
  await expect(page.locator('#seq li').first()).toHaveText(/CALIBRATING/, { timeout: 10_000 });
});

test('a network that connects but never answers: the saved page opens after the 3 s limit', async ({ page, context }) => {
  await page.goto('/src/phone/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
  await context.route('**/src/phone/', () => {}); // never answered; Playwright sees the service worker's own fetches
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10_000 });
  await expect(page.getByRole('tab', { name: 'Listen' })).toBeVisible();
});

test('an update keeps only the newest older cache, and the new copy wins over the older one', async ({ page }) => {
  await page.goto('/src/phone/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
  const { keys, body } = await page.evaluate(async () => {
    const asset = document.querySelector<HTMLScriptElement>('script[type=module]')!.src; // under /assets/, served cache first
    for (const k of await caches.keys()) await caches.delete(k); // so the install below makes the newest cache, as a deploy does
    await caches.open('stratum-old1');
    await (await caches.open('stratum-old2')).put(asset, new Response('stale'));
    const w = (await navigator.serviceWorker.register('/sw.js?deploy')).installing!; // a new script URL installs a new worker, as a deploy does
    await new Promise((r) => w.addEventListener('statechange', () => { if (w.state === 'activated') r(0); })); // after its activate handler, not at controllerchange
    return { keys: await caches.keys(), body: await (await fetch(asset)).text() };
  });
  expect(keys).toEqual(['stratum-old2', expect.stringMatching(/^stratum-[0-9a-f]{12}$/)]);
  expect(body).not.toBe('stale'); // caches.match alone would find the older cache's copy first
});

test('the manifest is linked from every page and Chrome can install from it', async ({ page, request }) => {
  for (const path of ['/', '/src/phone/', '/src/district/', '/src/district/judge.html', '/src/district/coverage.html']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', '/manifest.webmanifest');
  }
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m).toMatchObject({ name: 'STRATUM', start_url: '/src/phone/', display: 'standalone' });
  expect((await request.get(m.start_url)).ok()).toBe(true);
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512']); // Chrome needs both
  for (const icon of m.icons) {
    const r = await request.get(icon.src);
    expect(r.ok()).toBe(true);
    expect(r.headers()['content-type']).toBe('image/png');
  }
});
