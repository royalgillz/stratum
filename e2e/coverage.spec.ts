import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { show } from '../src/district/problems.ts';
import { expectSoundLayout } from './layout.ts';

const cards = (page: Page) => page.locator('#matrix > li');
const evidence = (file: string) => `public/evidence/${file}`; // Playwright runs from the repo root
const seven = JSON.parse(readFileSync(evidence('seven-day.json'), 'utf8'));

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Coverage matrix, ${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      // The committed evidence files from disk: the matrix does not wait on the preview server.
      await page.route('**/evidence/*.json', (r) => r.fulfill({ path: evidence(new URL(r.request().url()).pathname.split('/').pop()!) }));
    });

    test('reachable from home and District 7; fifteen rows, each with a tier badge, a mechanism, both policies and a label', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'Coverage matrix' }).click();
      await expect(page.getByRole('heading', { name: 'Coverage matrix', level: 1 })).toBeVisible();
      await expect(cards(page)).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
      await expect(page.locator('#status')).toHaveText('');
      for (const [i, card] of (await cards(page).all()).entries()) {
        await expect(card.getByRole('heading', { level: 2 })).toHaveText(new RegExp(`^${i + 1}\\. `));
        await expect(card.locator('.badge').first()).toHaveText(/^(Live|Modelled|Thin|Roadmap)$/);
        await expect(card).toContainText('Mechanism:');
        await expect(card).toContainText(/(higher|lower) is better/);
        await expect(card.locator('.label')).toContainText('SIMULATED');
        await expect(card.locator('tbody th').first()).toContainText(i === 8 ? '30-day run, 20 seeds' : 'Seven-day week, 20 seeds');
        await expect(card.locator('tbody th', { hasText: 'Stress week, 20 seeds' })).toHaveCount(1);
      }
      await expect(page.locator('#matrix tbody tr')).toHaveCount(31); // seven-day and stress week for each, and p09's 30-day run
      // Problem 3 from the committed evidence: STRATUM's heat person-hours, interval below.
      await expect(cards(page).nth(2).locator('tbody td').nth(1)).toContainText(show(seven.policies.stratum.p03.final.mean, 'person-h'));
      // Problem 9's headline is the 30-day run; the small seven-day outbreak is marked as noise.
      await expect(cards(page).nth(8).locator('tbody tr').nth(1)).toContainText('small outbreak: noise');
      // The stress week has no separations: no placeholder zeros, no tie.
      await expect(cards(page).nth(7).locator('tbody tr').nth(1)).toContainText('no separations in this script');
      await expect(cards(page).nth(0)).toContainText('REPLAY ENF-WHU, 130 real 50 Hz recordings');
      await expect(cards(page).nth(3)).toContainText('REPLAY GECCO 2018, held-out half, 22 events');
      await expect(page.getByRole('heading', { name: /Results against us/ })).toBeVisible();
      await expectSoundLayout(page);

      await page.getByRole('link', { name: 'District 7' }).click();
      await expect(page.getByRole('heading', { name: 'District 7', level: 1 })).toBeVisible();
      await page.getByRole('link', { name: 'coverage matrix' }).click();
      await expect(cards(page)).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
    });

    test('an adapter missing from the evidence shows "not yet run"; a stress-week file adds its row, and a loss shows', async ({ page }) => {
      const week = structuredClone(seven);
      delete week.policies.directorate.p15;
      delete week.policies.stratum.p15;
      const stress = structuredClone(week);
      stress.script = 'stress-week';
      stress.policies.stratum.p03.final = { mean: 500, lo: 400, hi: 600, values: [400, 600] }; // STRATUM's heat above zero
      stress.policies.directorate.p03.final = { mean: 0, lo: 0, hi: 0, values: [0, 0] };
      await page.route('**/evidence/seven-day.json', (r) => r.fulfill({ json: week }));
      await page.route('**/evidence/stress-week.json', (r) => r.fulfill({ json: stress }));
      await page.goto('/src/district/coverage.html', { waitUntil: 'domcontentloaded' });
      await expect(cards(page)).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
      await expect(cards(page).nth(14).locator('tbody td')).toHaveText(['not yet run', 'not yet run', 'not yet run', 'not yet run']);
      const loss = cards(page).nth(2).locator('tbody tr').nth(1);
      await expect(loss).toContainText('Stress week, 20 seeds');
      await expect(loss).toContainText('Directorate better');
      await expect(loss).toContainText('95%: 400 person\u2011h to 600 person\u2011h'); // non-breaking hyphen
      await expectSoundLayout(page);
    });

    test('with no stress-week file, the matrix shows only the seven-day week and does not fail', async ({ page }) => {
      // Vite answers a missing file with its HTML page and status 200.
      await page.route('**/evidence/stress-week.json', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }));
      await page.goto('/src/district/coverage.html', { waitUntil: 'domcontentloaded' });
      await expect(cards(page)).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
      await expect(page.getByText(/Stress week/)).toHaveCount(0);
      await expect(page.locator('#matrix tbody tr')).toHaveCount(16); // p09 adds its 30-day run
      await expect(page.locator('#status')).toHaveText('');
    });
  });
}
