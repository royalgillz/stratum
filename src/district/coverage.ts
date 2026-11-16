// Coverage matrix page: the fifteen problems with tier, mechanism, the harness's headline metric under both
// policies, and the REPLAY scores, read from the evidence files the harness writes. Outside LID scope.
import type { Evidence, Summary } from '../../harness/summary.ts';
import { sevenDay } from '../core/scenario/seven-day.ts';
import { stressWeek } from '../core/scenario/stress-week.ts';
import type { Script } from '../core/scenario/types.ts';
import { badges, noEvent, PROBLEMS, show, winner, type Problem } from './problems.ts';

const SCRIPTS: Record<string, Script> = { 'seven-day': sevenDay, 'stress-week': stressWeek };
const timedOut: string[] = [];
/** An evidence file, or null when it is missing or not JSON (a static server may answer a missing file with a page). */
const get = <T>(file: string): Promise<T | null> =>
  fetch(`/evidence/${file}`, { signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? r.json() : null))
    .catch((e: Error) => (e.name === 'TimeoutError' && timedOut.push(file), null));

interface Rate { events: number; caught: number; precision: number; falseAlarmsPerWeek: number }
interface Gecco { headline: string; results: Record<string, { kinds: string[]; firstHalf: Rate; heldOut: Rate }> }
interface Enf { withHum: { clips: number; noHumShare: number; clipMedians: { clips: number; medianMHz: number; over500: number } }; noGrid: { whole: { clips: number; noHumShare: number } } }

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function figure(s: Summary | undefined): string {
  if (!s) return 'not yet run';
  const { mean, lo, hi } = s.final;
  return show(mean, s.unit) + (show(lo, s.unit) !== show(hi, s.unit) ? `<br><span class="muted">95%: ${show(lo, s.unit)} to ${show(hi, s.unit)}</span>` : '');
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
  return `<tr>${head}<br><span class="muted">${verdict}</span></th><td>${figure(d)}</td><td>${figure(s)}</td></tr>`;
}

// p09: the seven-day outbreak is small, so its result comes from the 30-day run (evidence design, "p09: outbreak").
const NOISE = 'small outbreak: noise';
function rows(p: Problem): string {
  const week = results('Seven-day week', seven, p, p.id === 'p09' ? NOISE : '') || '<tr><th scope="row">Seven-day week</th><td>not yet run</td><td>not yet run</td></tr>';
  return (p.id === 'p09' ? results('30-day run', thirty, p) : '') + week + results('Stress week', stress, p, p.id === 'p09' ? NOISE : '');
}

function replay(id: string, enf: Enf | null, gecco: Gecco | null): string {
  if (id === 'p01') {
    if (!enf) return '<p class="small"><span class="tag">REPLAY</span> ENF-WHU score file not found.</p>';
    const w = enf.withHum, c = w.clipMedians;
    return `<p class="small"><span class="tag">REPLAY</span> ENF-WHU, ${w.clips} real 50 Hz recordings: median of per-clip median errors ${c.medianMHz} mHz; ${c.over500} of the ${c.clips} clips with a median (${w.clips - c.clips} had none) are over 500 mHz (locked onto another tone); NO HUM on ${pct(w.noHumShare)} of readings with hum; NO HUM correct on ${pct(enf.noGrid.whole.noHumShare)} of readings from ${enf.noGrid.whole.clips} whole no-grid recordings.</p>`;
  }
  if (id === 'p04') {
    const q = gecco?.results[gecco.headline], k = gecco?.results.picked;
    if (!q || !k) return '<p class="small"><span class="tag">REPLAY</span> GECCO 2018 score file not found.</p>';
    const h = q.heldOut, m = k.heldOut;
    return `<p class="small"><span class="tag">REPLAY</span> GECCO 2018, held-out half, ${h.events} events, detector not tuned: the ${q.kinds.length} quality sensors catch ${h.caught}/${h.events} at precision ${h.precision.toFixed(3)} (${Math.round(h.falseAlarmsPerWeek)} false alarms a week); ${k.kinds.join(', ')}, chosen on the first half, catch ${m.caught}/${m.events} at precision ${m.precision.toFixed(2)} (${m.falseAlarmsPerWeek.toFixed(2)} false alarms a week) but caught only ${k.firstHalf.caught}/${k.firstHalf.events} on the first half.</p>`;
  }
  return '';
}

const [seven, thirty, stress, enf, gecco] = await Promise.all([
  get<Evidence>('seven-day.json'), get<Evidence>('30-day.json'), get<Evidence>('stress-week.json'), get<Enf>('enf-whu.json'), get<Gecco>('gecco.json'),
]);

document.getElementById('matrix')!.innerHTML = PROBLEMS.map((p, i) => `<li class="card" data-id="${p.id}">
  <h2>${i + 1}. ${p.title}</h2>
  <p class="tiers">${badges(p.tier).map((b) => `<span class="badge">${b}</span>`).join(' ')} <span class="small muted">${p.tier}</span></p>
  <p class="small"><b>Mechanism:</b> ${p.mechanism}</p>
  <p class="small"><b>Metric:</b> ${p.metric}, ${p.better} is better</p>
  <table class="small">
    <thead><tr><th scope="col">District 7 <span class="tag">SIMULATED</span></th><th scope="col">Directorate</th><th scope="col">STRATUM</th></tr></thead>
    <tbody>${rows(p)}</tbody>
  </table>
  ${replay(p.id, enf, gecco)}
  <p class="small label"><b>Label:</b> ${p.labels}</p>
</li>`).join('');
document.getElementById('status')!.textContent = [
  seven ? '' : 'The seven-day evidence file was not found: run npm run harness -- --seeds 20.',
  timedOut.length ? `Timed out loading ${timedOut.join(', ')}: reload to try again.` : '',
].filter(Boolean).join(' ');
