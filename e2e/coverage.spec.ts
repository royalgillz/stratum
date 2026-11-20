import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { show } from '../src/district/problems.ts';
import { expectSoundLayout } from './layout.ts';

const cards = (page: Page) => page.locator('#matrix > li');
const evidence = (file: string) => `public/evidence/${file}`; // Playwright runs from the repo root
const seven = JSON.parse(readFileSync(evidence('seven-day.json'), 'utf8'));
const tiers = JSON.parse(readFileSync(evidence('enf-whu.json'), 'utf8')).tiers.absolute;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

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
      await expect(page.locator('#matrix tbody tr:not(.beside)')).toHaveCount(31); // seven-day and stress week for each, and p09's 30-day run
      await expect(cards(page).nth(11).locator('tbody tr', { hasText: 'Stress week' })).toContainText('against STRATUM: the metric reads higher, but every level breaches');
      await expect(cards(page).nth(13).locator('tr.beside', { hasText: 'trial breaches' }).last()).toContainText('4'); // the stress week's cost is on screen
      // Problem 1's air score from the committed evidence: one beside row, the seven-day week's fan stops only.
      const air = seven.policies.directorate.p01.beside.airUnwarnedH;
      await expect(cards(page).nth(0).locator('tr.beside')).toHaveCount(1);
      await expect(cards(page).nth(0).locator('tr.beside')).toContainText(`${air.name}${show(air.mean, air.unit)}${show(seven.policies.stratum.p01.beside.airUnwarnedH.mean, air.unit)}`);
      // Problem 3 from the committed evidence: STRATUM's heat person-hours, interval below.
      await expect(cards(page).nth(2).locator('tbody td').nth(1)).toContainText(show(seven.policies.stratum.p03.final.mean, 'person-h'));
      // Problem 9's headline is the 30-day run; the small seven-day outbreak is marked as noise.
      await expect(cards(page).nth(8).locator('tbody tr').nth(1)).toContainText('small outbreak: noise');
      // The stress week has no separations: no placeholder zeros, no tie.
      await expect(cards(page).nth(7).locator('tbody tr').nth(1)).toContainText('no separations in this script');
      await expect(cards(page).nth(0)).toContainText('REPLAY ENF-WHU, 130 real 50 Hz recordings');
      // The tiers on the real grid, false warnings first, in the same REPLAY paragraph
      await expect(cards(page).nth(0).locator('p', { hasText: 'REPLAY ENF-WHU' })).toContainText(`Tiers as shipped, against the grid's own record: where the grid stayed GREEN the tracker showed AMBER or RED on ${pct(tiers.falseAlarmShare)} of readings (${tiers.falseEntriesPerHour} false warnings per hour of tiers shown), and it showed GREEN on ${pct(tiers.missShare)} of readings where the grid was AMBER or RED (the grid left GREEN in ${tiers.clipsRefAlert} of the 130 recordings).`);
      await expect(cards(page).nth(3)).toContainText('REPLAY GECCO 2018, held-out half, 22 events');
      await expect(cards(page).nth(3)).toContainText('pH, Redox, conductivity, chosen on the first half'); // not the dataset's "Leit"
      // A Directorate 0 set by its own rule says so (p01: no warning tool; p07: the 06:00 bulletin only)
      await expect(cards(page).nth(0).locator('tbody td').first()).toContainText('0% (no tool, by rule)');
      await expect(cards(page).nth(6).locator('tbody td').first()).toContainText('0% (06:00 bulletin only)');

      // Results at a glance, above the cards: the cards' verdicts counted from the committed evidence, the stress-week losses linked
      const glance = page.locator('#glance');
      expect((await glance.boundingBox())!.y).toBeLessThan((await cards(page).first().boundingBox())!.y);
      await expect(glance).toContainText('Seven-day week, 20 seeds, SIMULATED: STRATUM better on 14 of the 14 problems the week can score, including power cuts warned at least 10 min ahead (STRATUM 40% vs Directorate 0%) and need met for the worst-off tenth (STRATUM 85% vs Directorate 66%).');
      const lost = glance.locator('li li');
      await expect(lost).toHaveText([
        /^1\. Warn before power or air cuts: Directorate 0%, STRATUM 0%; a tie, the warning gain is gone$/,
        // docs/coverage.md marks rows 3 and 5 against STRATUM too: a win that lost most of its lead, or its zero
        /^3\. .*: Directorate 178,000 person‑h, STRATUM 139,000 person‑h; STRATUM still better, but its lead shrinks from 86% to 22%$/,
        /^5\. .*: Directorate 28,800 person‑h, STRATUM 20,500 person‑h; STRATUM still better, but its seven-day zero is gone$/,
        /^12\. .*: Directorate 3 days, STRATUM 5 days; against STRATUM: the metric reads higher, but every level breaches the food floor$/,
        /^13\. .*: Directorate 0%, STRATUM 100%; Directorate better, STRATUM's verdict is in the wrong band in every round \(wrong-band rate, lower is better\)$/,
        /^14\. .*; a tie, nothing lighter proven, 4 breaches in the planned trial under STRATUM \(Directorate 0\)$/,
      ]);
      for (const n of [12, 13]) {
        await expect(glance.locator(`a[href="#problem-${n}"]`)).toHaveText(new RegExp(`^${n}\. `));
        await expect(page.locator(`#problem-${n} h2`)).toHaveText(new RegExp(`^${n}\. `));
      }
      await expect(glance.getByRole('link', { name: 'Results against us' })).toHaveAttribute('href', '#againstTitle');
      await expect(page.getByText('Tier = how far it is built; label (LIVE, REPLAY, SIMULATED) = where the number came from.')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Results against us/ })).toBeVisible();
      await expectSoundLayout(page);

      await page.getByRole('link', { name: 'District 7' }).click();
      await expect(page.getByRole('heading', { name: 'District 7', level: 1 })).toBeVisible();
      await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Coverage matrix' }).click();
      await expect(cards(page)).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
    });

    test('charts: a dumbbell row per problem, what each engine contributes, a line chart per swept metric; no sideways scroll at 344 px', async ({ page }) => {
      await page.goto('/src/district/coverage.html', { waitUntil: 'domcontentloaded' });
      const rows = page.locator('#dumbbells > li');
      await expect(rows).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
      // Under "Results at a glance", above the cards; labelled SIMULATED; every problem scores in the week, so every row is drawn
      await expect(page.getByRole('heading', { name: 'STRATUM against the Directorate, seven-day week SIMULATED', level: 3 })).toBeVisible();
      expect((await rows.first().boundingBox())!.y).toBeLessThan((await cards(page).first().boundingBox())!.y);
      await expect(page.locator('#dumbbells svg.db-svg')).toHaveCount(15);
      for (const [i, row] of (await rows.all()).entries()) {
        await expect(row.getByRole('link')).toHaveText(new RegExp(`^${i + 1}\\. `));
        await expect(row).toContainText(/(higher|lower) is better/);
        await expect(row.locator('.db-v')).toHaveText([/^Directorate: /, /^STRATUM: /]); // both values printed, named
        await expect(row.locator('b')).toHaveText(/^(Directorate|STRATUM): .*, better$/); // the better one by direction
        await expect(row.locator('.mk-best')).toHaveCount(1);
      }
      await expect(rows.nth(2).locator('b')).toHaveText(`STRATUM: ${show(seven.policies.stratum.p03.final.mean, 'person-h')}, better`);
      await expect(rows.nth(8)).toContainText('small outbreak: noise: card 9 has the 30-day run');

      // What each engine contributes: the three engines, a worse-without line with its interval, and the result against us
      const eng = page.locator('#engines');
      await expect(eng.locator('section.engine h3')).toHaveText(['Witness off', 'Mesh off', 'Fair Share off']);
      await expect(eng.locator('[data-engine=witness] li[data-id=p04]')).toContainText('STRATUM 0 person‑h, without Witness 23,300 person‑h: worse without it; change +23,300 person‑h (95%: +22,100 person‑h to +24,500 person‑h)');
      await expect(eng).toContainText('Against STRATUM: the engines barely interact. 15 of the 16 changes'); // only changes whose interval excludes 0
      await expect(eng).toContainText('Cross effects: Fair Share off moves 1. Warn before power or air cuts. No clear change, the interval spans 0: Fair Share off on 9. Track the real outbreak');
      await expect(eng.locator('[data-engine=fairShare] li.cross')).toHaveCount(2);
      await expect(eng.locator('[data-engine=fairShare] li[data-id=p09]')).toContainText('no clear change, the interval spans 0');

      // Sweeps: one chart per swept metric, both rules drawn, SIMULATED, and where STRATUM is not better
      const sw = page.locator('#sweeps');
      await expect(sw.locator('section.sweep h3')).toHaveText(['Surface crews that falsify their readings', 'Depth of the deep shortfall', 'Size of the outbreak seed', 'Grid inertia', 'Under-reporting']);
      const charts = sw.getByRole('img');
      await expect(charts).toHaveCount(10);
      for (const c of await charts.all()) {
        await expect(c).toHaveAttribute('aria-label', /, SIMULATED\. Directorate .*\. STRATUM .*\./);
        await expect(c.locator('polyline')).toHaveCount(2);
      }
      await expect(sw.locator('[data-sweep=lying-crews] li[data-id=p13]')).toContainText('Against STRATUM: STRATUM not better at 3, 4, 5 crews of 5');
      await expect(sw.locator('[data-sweep=outbreak]')).toContainText("STRATUM's worst is 36% at 5 (best 11% at 40)");
      await expect(sw).not.toContainText('Not run'); // every planned sweep ran
      const table = sw.locator('[data-sweep=outbreak] details');
      expect((await table.locator('summary').boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await table.locator('summary').click();
      await expect(table.locator('tbody tr')).toHaveCount(5);
      await expect(table.locator('tbody tr').first()).toContainText('95%:');
      await expectSoundLayout(page);
      // Every disclosure open (the deep-shortfall heat table has the longest intervals): still no sideways scroll
      await page.locator('details').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
      await expect(sw.locator('details[open]')).toHaveCount(10);
      await expectSoundLayout(page);

      await page.setViewportSize({ width: 344, height: 800 }); // the narrowest phone the site is laid out for
      await expectSoundLayout(page);
    });

    test('result first: the glance and the results against us above the cards; each card shows its verdict row and folds the rest; a link opens its card', async ({ page }) => {
      await page.goto('/src/district/coverage.html', { waitUntil: 'domcontentloaded' });
      await expect(cards(page)).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
      const p12 = page.locator('#problem-12');
      await expect(p12.locator('h2')).toBeVisible();
      await expect(p12.locator('.badge').first()).toBeVisible();
      await expect(p12.locator('table')).toBeHidden();
      expect((await p12.locator('summary').boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // The REPLAY scores stay outside the fold, with their label, including the GECCO result against us
      await expect(cards(page).nth(0).locator('p', { hasText: 'REPLAY ENF-WHU' })).toBeVisible();
      const gecco = cards(page).nth(3).locator('p', { hasText: 'REPLAY GECCO 2018' });
      await expect(gecco).toBeVisible();
      await expect(gecco).toContainText('but caught only');
      // The results against us come before the fifteen cards; the badge legend sits with the cards
      const y = async (name: RegExp) => (await page.getByRole('heading', { name, level: 2 }).boundingBox())!.y;
      expect(await y(/^Results against us/)).toBeLessThan(await y(/^The fifteen problems$/));
      expect(await y(/^The fifteen problems$/)).toBeLessThan((await cards(page).first().boundingBox())!.y);
      await expect(page.getByText("Where a rule alone sets the Directorate's figure (no warnings, a daily lab, a daily bulletin), the gap shows the mechanism, not a measured gain.")).toBeVisible();
      // Engines: the result against us stays open, the per-engine detail folds
      await expect(page.getByText('Against STRATUM: the engines barely interact')).toBeVisible();
      await expect(page.locator('#engines section.engine').first()).toBeHidden();
      await expectSoundLayout(page);
      // A glance link opens the folded card it points to
      await page.locator('#glance a[href="#problem-12"]').click();
      await expect(p12.locator('details')).toHaveAttribute('open', '');
      await expect(p12.locator('tbody tr', { hasText: 'Stress week' })).toBeVisible();
      // Closed by the reader, the same link opens it again (the hash does not change, so no hashchange)
      await p12.locator('summary').click();
      await expect(p12.locator('details')).not.toHaveAttribute('open', '');
      await page.locator('#glance a[href="#problem-12"]').click();
      await expect(p12.locator('details')).toHaveAttribute('open', '');
      // The stress-week losses are set at the same size as the win above them
      const size = (sel: string) => page.locator(sel).evaluate((e) => getComputedStyle(e).fontSize);
      expect(await size('#glance > li:has(> ul)')).toBe(await size('#glance > li:first-child'));
      // So does arriving on a card's address
      await page.goto('/src/district/coverage.html#problem-13', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#problem-13 details')).toHaveAttribute('open', '', { timeout: 15_000 });
      await expect(page.locator('#problem-13 table')).toBeVisible();
      await page.setViewportSize({ width: 344, height: 800 }); // the narrowest phone the site is laid out for
      await expectSoundLayout(page);
    });

    test('a problem with no event in the week says so instead of a row; missing ablation and sweep files say how to make them', async ({ page }) => {
      const week = structuredClone(seven);
      week.script = 'stress-week'; // a script with no separations: problem 8 has no result
      await page.route('**/evidence/seven-day.json', (r) => r.fulfill({ json: week }));
      for (const f of ['ablations', 'sweeps']) await page.route(`**/evidence/${f}.json`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }));
      await page.goto('/src/district/coverage.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#dumbbells > li')).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
      const p08 = page.locator('#dumbbells > li[data-id=p08]');
      await expect(p08).toContainText('no separations in this script');
      await expect(p08.locator('svg')).toHaveCount(0);
      await expect(page.locator('#engines')).toHaveText('The ablation file was not found: run npm run harness:ablations -- --seeds 20.');
      await expect(page.locator('#sweeps')).toHaveText('The sweep file was not found: run npm run harness:sweeps -- --seeds 20.');
      await expectSoundLayout(page);
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
      // The glance counts what the files hold: p15 missing from the week, p03 lost in the stress week
      await expect(page.locator('#glance')).toContainText('STRATUM better on 13 of the 13 problems the week can score');
      await expect(page.locator('#glance li li', { hasText: '3. Keep lower levels livable' })).toContainText('Directorate 0 person\u2011h, STRATUM 500 person\u2011h; Directorate better');
      await expectSoundLayout(page);
    });

    test('with no stress-week file, the matrix shows only the seven-day week and does not fail', async ({ page }) => {
      // Vite answers a missing file with its HTML page and status 200.
      await page.route('**/evidence/stress-week.json', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }));
      await page.goto('/src/district/coverage.html', { waitUntil: 'domcontentloaded' });
      await expect(cards(page)).toHaveCount(15, { timeout: 15_000 }); // the page script still comes from the preview server, which stalls under load
      await expect(page.getByText(/Stress week/)).toHaveCount(0);
      await expect(page.locator('#matrix tbody tr:not(.beside)')).toHaveCount(16); // p09 adds its 30-day run
      await expect(page.locator('#glance')).toContainText('STRATUM better on 14 of the 14'); // the seven-day line stands alone
      await expect(page.locator('#status')).toHaveText('');
    });
  });
}
