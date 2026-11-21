// Coverage matrix page: the fifteen problems with tier, mechanism, the harness's headline metric under both
// policies, and the REPLAY scores, read from the evidence files the harness writes. Outside src/core.
import type { Evidence, Summary } from '../../harness/summary.ts';
import { sevenDay } from '../core/scenario/seven-day.ts';
import { stressWeek } from '../core/scenario/stress-week.ts';
import type { Script } from '../core/scenario/types.ts';
import { dumbbell, engines, sweep, type Ablations, type Sweeps } from './charts.ts';
import { badges, noEvent, NOISE, PROBLEMS, show, winner, ZERO_BY_RULE, type Problem } from './problems.ts';

const SCRIPTS: Record<string, Script> = { 'seven-day': sevenDay, 'stress-week': stressWeek };
const timedOut: string[] = [];
/** An evidence file, or null when it is missing or not JSON (a static server may answer a missing file with a page). */
const get = <T>(file: string): Promise<T | null> =>
  fetch(`/evidence/${file}`, { signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? r.json() : null))
    .catch((e: Error) => (e.name === 'TimeoutError' && timedOut.push(file), null));

interface Rate { events: number; caught: number; precision: number; falseAlarmsPerWeek: number }
interface Gecco { headline: string; results: Record<string, { kinds: string[]; firstHalf: Rate; heldOut: Rate }> }
interface Enf {
  withHum: { clips: number; noHumShare: number; clipMedians: { clips: number; medianMHz: number; over500: number } };
  tiers: { absolute: { falseAlarmShare: number; falseEntriesPerHour: number; missShare: number; clipsRefAlert: number } };
  noGrid: { whole: { clips: number; noHumShare: number } };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** `rule`: why a 0 is set by the Directorate's rule, printed beside it. */
function figure(s: Summary | undefined, rule?: string): string {
  if (!s) return 'not yet run';
  const { mean, lo, hi } = s.final;
  return show(mean, s.unit) + (rule && mean === 0 ? ` (${rule})` : '') + (show(lo, s.unit) !== show(hi, s.unit) ? `<br><span class="muted">95%: ${show(lo, s.unit)} to ${show(hi, s.unit)}</span>` : '');
}

/** One run's row; `note` replaces the verdict when the run cannot settle it. */
function results(name: string, e: Evidence | null, p: Problem, note = ''): string {
  if (!e?.policies) return '';
  const head = `<th scope="row">${name}, ${e.seeds.length} seeds`;
  const none = noEvent(p.id, SCRIPTS[e.script]?.events ?? [], e.days * 86400);
  if (none) return `<tr>${head}</th><td colspan="2">${none}</td></tr>`;
  const d = e.policies.directorate?.[p.id], s = e.policies.stratum?.[p.id];
  const better = d && s ? winner(p.better, d.final.mean, s.final.mean) : null;
  const verdict = note || (better ? (better === 'tie' ? 'tie' : `${better} better`) : '');
  // The figures the designs report beside the metric (often its cost), one row each under the run.
  const beside = Object.entries(d?.beside ?? {}).map(([k, b]) => `<tr class="beside"><th scope="row" class="muted">beside it: ${b.name}</th>`
    + `<td>${show(b.mean, b.unit)}</td><td>${s?.beside?.[k] ? show(s.beside[k].mean, b.unit) : 'not yet run'}</td></tr>`).join('');
  return `<tr>${head}<br><span class="muted">${verdict}</span></th><td>${figure(d, ZERO_BY_RULE[p.id])}</td><td>${figure(s)}</td></tr>${beside}`;
}

// p12 in the stress week: STRATUM's floor holds longer on the cut-off levels, but every level breaches (docs/coverage.md row 12).
const STRESS_NOTE: Partial<Record<Problem['id'], string>> = { p09: NOISE, p12: 'against STRATUM: the metric reads higher, but every level breaches the food floor' };
function rows(p: Problem): string {
  const week = results('Seven-day week', seven, p, p.id === 'p09' ? NOISE : '') || '<tr><th scope="row">Seven-day week</th><td>not yet run</td><td>not yet run</td></tr>';
  return (p.id === 'p09' ? results('30-day run', thirty, p) : '') + week + results('Stress week', stress, p, STRESS_NOTE[p.id]);
}

function replay(id: string, enf: Enf | null, gecco: Gecco | null): string {
  if (id === 'p01') {
    if (!enf) return '<p class="small"><span class="tag">REPLAY</span> ENF-WHU score file not found.</p>';
    const w = enf.withHum, c = w.clipMedians, t = enf.tiers.absolute;
    return `<p class="small"><span class="tag">REPLAY</span> ENF-WHU, ${w.clips} real 50 Hz recordings: median of per-clip median errors ${c.medianMHz} mHz; ${c.over500} of the ${c.clips} clips with a median (${w.clips - c.clips} had none) are over 500 mHz (locked onto another tone); NO HUM on ${pct(w.noHumShare)} of readings with hum; NO HUM correct on ${pct(enf.noGrid.whole.noHumShare)} of readings from ${enf.noGrid.whole.clips} whole no-grid recordings. `
      + `Tiers as shipped, against the grid's own record: where the grid stayed GREEN the tracker showed AMBER or RED on ${pct(t.falseAlarmShare)} of readings (${t.falseEntriesPerHour} false warnings per hour of tiers shown), and it showed GREEN on ${pct(t.missShare)} of readings where the grid was AMBER or RED (the grid left GREEN in ${t.clipsRefAlert} of the ${w.clips} recordings).</p>`;
  }
  if (id === 'p04') {
    const q = gecco?.results[gecco.headline], k = gecco?.results.picked;
    if (!q || !k) return '<p class="small"><span class="tag">REPLAY</span> GECCO 2018 score file not found.</p>';
    const h = q.heldOut, m = k.heldOut;
    const kinds = k.kinds.map((x) => (x === 'Leit' ? 'conductivity' : x)).join(', '); // Leit: the dataset's German column name
    return `<p class="small"><span class="tag">REPLAY</span> GECCO 2018, held-out half, ${h.events} events, detector not tuned: the ${q.kinds.length} quality sensors catch ${h.caught}/${h.events} at precision ${h.precision.toFixed(3)} (${Math.round(h.falseAlarmsPerWeek)} false alarms a week); ${kinds}, chosen on the first half, catch ${m.caught}/${m.events} at precision ${m.precision.toFixed(2)} (${m.falseAlarmsPerWeek.toFixed(2)} false alarms a week) but caught only ${k.firstHalf.caught}/${k.firstHalf.events} on the first half.</p>`;
  }
  return '';
}

const [seven, thirty, stress, enf, gecco, ablations, sweeps] = await Promise.all([
  get<Evidence>('seven-day.json'), get<Evidence>('30-day.json'), get<Evidence>('stress-week.json'), get<Enf>('enf-whu.json'), get<Gecco>('gecco.json'),
  get<Ablations>('ablations.json'), get<Sweeps>('sweeps.json'),
]);

// At a glance: the cards' own verdicts, counted. The seven-day wins, then every stress-week row STRATUM does not win,
// each as a list of the same form (card: Directorate, STRATUM; verdict), so the wins and the losses carry the same weight.
const verdict = (e: Evidence, p: Problem, note = '') => {
  const d = e.policies.directorate?.[p.id], s = e.policies.stratum?.[p.id];
  if (note || !d || !s || noEvent(p.id, SCRIPTS[e.script]?.events ?? [], e.days * 86400)) return { note, d, s, w: null };
  return { note, d, s, w: winner(p.better, d.final.mean, s.final.mean) };
};
const card = (p: Problem) => `<a href="#problem-${PROBLEMS.indexOf(p) + 1}">${PROBLEMS.indexOf(p) + 1}. ${p.title}</a>`;
const glance: string[] = [];
if (seven?.policies) {
  const scored = PROBLEMS.map((p) => ({ p, ...verdict(seven, p, p.id === 'p09' ? NOISE : '') })).filter((x) => x.w);
  const rest = scored.filter((x) => x.w !== 'STRATUM').map((x) => `${card(x.p)}: ${x.w === 'tie' ? 'a tie' : 'Directorate better'}`);
  const vs = (id: Problem['id'], what: string) => { const x = scored.find((y) => y.p.id === id); return x ? [`${what} (STRATUM ${show(x.s!.final.mean, x.s!.unit)} vs Directorate ${show(x.d!.final.mean, x.d!.unit)})`] : []; };
  const wins = [...vs('p01', 'power cuts warned at least 10 min ahead'), ...vs('p02', 'need met for the worst-off tenth')];
  const won = scored.filter((x) => x.w === 'STRATUM').map((x) => {
    const rule = x.d!.final.mean === 0 && ZERO_BY_RULE[x.p.id] ? ` (${ZERO_BY_RULE[x.p.id]})` : '';
    return `<li>${card(x.p)}: Directorate ${show(x.d!.final.mean, x.d!.unit)}${rule}, STRATUM ${show(x.s!.final.mean, x.s!.unit)}; STRATUM better</li>`;
  });
  glance.push(`<li class="wins"><p class="lead">Seven-day week, ${seven.seeds.length} seeds, <span class="tag">SIMULATED</span>: STRATUM better on <strong>${scored.filter((x) => x.w === 'STRATUM').length} of the ${scored.length}</strong> problems the week can score${rest.length ? ` (${rest.join('; ')})` : ''}${wins.length ? `, including ${wins.join(' and ')}` : ''}. Problem 9's outbreak is too small to score in a week: see its 30-day run.</p>${won.length ? `<ul class="list">${won.join('')}</ul>` : ''}</li>`);
}
// What each stress-week loss means, in words the cards do not print.
const AGAINST: Partial<Record<Problem['id'], string>> = { p01: 'the warning gain is gone', p13: "STRATUM's verdict is in the wrong band in every round (wrong-band rate, lower is better)", p14: 'nothing lighter proven' };
/** STRATUM's lead over the Directorate as a share of the Directorate's figure, or null when there is none to shrink. */
const lead = (e: Evidence | null, p: Problem) => {
  const d = e?.policies?.directorate?.[p.id]?.final.mean, s = e?.policies?.stratum?.[p.id]?.final.mean;
  return d && s !== undefined && winner(p.better, d, s) === 'STRATUM' ? Math.abs(d - s) / Math.abs(d) : null;
};
/** A stress-week win that lost a seven-day zero or most of a seven-day lead (the docs/coverage.md rule for "against STRATUM"). */
function shrunk(p: Problem): string {
  const was = lead(seven, p), now = lead(stress, p);
  if (was === null || now === null) return '';
  if (seven!.policies.stratum?.[p.id]?.final.mean === 0 && stress!.policies.stratum![p.id]!.final.mean > 0) return 'STRATUM still better, but its seven-day zero is gone';
  return now < was / 2 ? `STRATUM still better, but its lead shrinks from ${Math.round(was * 100)}% to ${Math.round(now * 100)}%` : '';
}
if (stress?.policies) {
  const lost = PROBLEMS.map((p) => ({ p, ...verdict(stress, p, STRESS_NOTE[p.id]?.startsWith('against') ? STRESS_NOTE[p.id] : shrunk(p)) }))
    .filter((x) => x.d && x.s && (x.note || (x.w && x.w !== 'STRATUM')))
    .map((x) => {
      const b = x.s!.beside?.breaches?.mean; // p14: the planned trial's breaches, the cost the tie hides
      return `<li>${card(x.p)}: Directorate ${show(x.d!.final.mean, x.d!.unit)}, STRATUM ${show(x.s!.final.mean, x.s!.unit)}; ${x.note || (x.w === 'tie' ? 'a tie' : 'Directorate better')}${AGAINST[x.p.id] ? `, ${AGAINST[x.p.id]}` : ''}${b ? `, ${b} breaches in the planned trial under STRATUM (Directorate ${x.d!.beside?.breaches?.mean ?? 0})` : ''}</li>`;
    });
  if (lost.length) glance.push(`<li class="losses"><p class="lead">Stress week, ${stress.seeds.length} seeds, <span class="tag">SIMULATED</span>, against us:</p><ul class="list">${lost.join('')}</ul></li>`);
}
glance.push('<li>What each engine adds, and how the results move under a harder stress: <a href="#enginesTitle">What each engine contributes</a>, <a href="#sweepsTitle">Sweeps</a>.</li>');
glance.push('<li>Limits of the model and the plan: <a href="#againstTitle">Results against us</a>.</li>');
document.getElementById('glance')!.innerHTML = glance.join('');

// The seven-day week as one dumbbell row per problem; a problem the week cannot score says why instead.
document.getElementById('dumbbells')!.innerHTML = PROBLEMS.map((p) => {
  const d = seven?.policies?.directorate?.[p.id], s = seven?.policies?.stratum?.[p.id];
  if (!seven || !d || !s) return dumbbell(p, 'not yet run');
  const none = noEvent(p.id, SCRIPTS[seven.script]?.events ?? [], seven.days * 86400);
  return none ? dumbbell(p, none) : dumbbell(p, { d: d.final.mean, s: s.final.mean, unit: s.unit }, p.id === 'p09' ? `${NOISE}: card 9 has the 30-day run` : '');
}).join('');
document.getElementById('engines')!.innerHTML = ablations?.conditions ? engines(ablations)
  : '<p class="small">The ablation file was not found: run npm run harness:ablations -- --seeds 20.</p>';
document.getElementById('sweeps')!.innerHTML = sweeps?.sweeps ? sweeps.sweeps.map((w) => sweep(w, sweeps.seeds.length)).join('')
  + (sweeps.skipped?.length ? `<p class="small">Not run, because each needs a model constant changed rather than the script: ${sweeps.skipped.map((k) => k.why).join(' ')}</p>` : '')
  : '<p class="small">The sweep file was not found: run npm run harness:sweeps -- --seeds 20.</p>';

document.getElementById('matrix')!.innerHTML = PROBLEMS.map((p, i) => `<li class="card" id="problem-${i + 1}" data-id="${p.id}">
  <h2>${i + 1}. ${p.title}</h2>
  <p class="tiers">${badges(p.tier).map((b) => `<span class="badge">${b}</span>`).join(' ')} <span class="small muted">${p.tier}</span></p>
  ${replay(p.id, enf, gecco)}
  <details class="small"><summary>Mechanism, figures and label</summary>
  <p><b>Mechanism:</b> ${p.mechanism}</p>
  <p><b>Metric:</b> ${p.metric}, ${p.better} is better</p>
  <table>
    <thead><tr><th scope="col">District 7 <span class="tag">SIMULATED</span></th><th scope="col">Directorate</th><th scope="col">STRATUM</th></tr></thead>
    <tbody>${rows(p)}</tbody>
  </table>
  <p class="label"><b>Label:</b> ${p.labels}</p>
  </details>
</li>`).join('');
// A link to a card (glance, dumbbells, engines) opens its folded body.
const openCard = (h: string) => { if (/^#problem-\d+$/.test(h)) document.querySelector(`${h} details`)?.setAttribute('open', ''); };
openCard(location.hash); addEventListener('hashchange', () => openCard(location.hash));
// A link to a card the reader closed leaves the hash unchanged (no hashchange), so the click opens it too.
addEventListener('click', (e) => openCard((e.target as Element).closest?.('a')?.getAttribute('href') ?? ''));
document.getElementById('status')!.textContent = [
  seven ? '' : 'The seven-day evidence file was not found: run npm run harness -- --seeds 20.',
  timedOut.length ? `Timed out loading ${timedOut.join(', ')}: reload to try again.` : '',
].filter(Boolean).join(' ');
