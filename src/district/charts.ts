// Coverage-page charts as HTML and hand-written SVG strings, built from the evidence files: a dumbbell per problem,
// the ablation list and one small line chart per swept metric. Pure: no DOM, so the unit tests run in Node. Outside LID scope.
import type { Final } from '../../harness/summary.ts';
import type { AdapterId } from '../core/contracts.ts';
import { PROBLEMS, show, winner, type Problem } from './problems.ts';

type Stat = { mean: number; lo: number; hi: number };
type Pol = 'directorate' | 'stratum';
export interface Sweep {
  id: string; title: string; stress: string;
  x: { name: string; unit: string; values: number[] };
  metrics: AdapterId[];
  points: { x: number; policies: Record<Pol, Partial<Record<AdapterId, Final>>> }[];
}
export interface Sweeps { seeds: number[]; sweeps: Sweep[]; skipped: { id: string; why: string }[] }
export interface Ablations {
  seeds: number[];
  engines: Record<string, AdapterId[]>;
  conditions: Record<string, { title: string; off: string | null; metrics: Partial<Record<AdapterId, Final>> }>;
  contribution: Record<string, Partial<Record<AdapterId, Stat>>>;
}

const NAMES: Record<Pol, string> = { directorate: 'Directorate', stratum: 'STRATUM' };
const num = (p: Problem) => PROBLEMS.indexOf(p) + 1;
const link = (p: Problem) => `<a href="#problem-${num(p)}">${num(p)}. ${p.title}</a>`;
const shares = (unit: string) => unit === 'share' || unit === 'ratio';

/** The Directorate's mark is a square, STRATUM's a circle: identity is never colour alone. */
const SHAPE: Record<Pol, string> = {
  directorate: '<rect class="mk-d" x="-5.5" y="-5.5" width="11" height="11" rx="1"/>',
  stratum: '<circle class="mk-s" r="6"/>',
};
/** A key mark for a label or legend. */
export const key = (p: Pol) => `<svg class="mk" width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true" focusable="false">${SHAPE[p]}</svg>`;

/** A dot's place on a row's own scale, as a percentage: 0 at the left, the larger value (or 100% for shares) at the right. */
export function place(v: number, d: number, s: number, unit: string): number {
  const top = shares(unit) ? Math.max(1, d, s) : Math.max(d, s) || 1;
  return Math.round(1000 * Math.min(1, Math.max(0, v / top))) / 10;
}

/** One problem's dumbbell row; `none` replaces the chart when the week has no result for it. */
export function dumbbell(p: Problem, pair: { d: number; s: number; unit: string } | string, note = ''): string {
  const head = `<p class="db-h">${link(p)}<br><span class="muted">${p.metric}, ${p.better} is better</span></p>`;
  if (typeof pair === 'string') return `<li class="db" data-id="${p.id}">${head}<p class="small muted">${pair}</p></li>`;
  const { d, s, unit } = pair, w = winner(p.better, d, s), v = { directorate: d, stratum: s };
  const at = (k: Pol) => place(v[k], d, s, unit);
  const label = (k: Pol) => {
    const best = w === NAMES[k], x = at(k);
    const text = `${NAMES[k]}: ${show(v[k], unit)}${best ? ', better' : w === 'tie' ? ', a tie' : ''}`;
    return `<span class="db-v" style="left:${x}%;transform:translateX(-${x}%)">${key(k)}${best ? `<b>${text}</b>` : text}</span>`;
  };
  const dot = (k: Pol) => `<svg x="${at(k)}%" y="13" overflow="visible">${w === NAMES[k] ? '<circle class="mk-best" r="9.5"/>' : ''}${SHAPE[k]}</svg>`;
  return `<li class="db" data-id="${p.id}">${head}<div class="db-plot">${label('directorate')}`
    + `<svg class="db-svg" width="100%" height="26" aria-hidden="true" focusable="false"><line class="db-track" x1="0" x2="100%" y1="13" y2="13"/>`
    + `<line class="db-bar" x1="${at('directorate')}%" x2="${at('stratum')}%" y1="13" y2="13"/>${dot('directorate')}${dot('stratum')}</svg>`
    + `${label('stratum')}</div>${note ? `<p class="small muted">${note}</p>` : ''}</li>`;
}

/** A change in a metric: shares and ratios in percentage points, signed. */
export function change(v: number, unit: string): string {
  const a = Math.abs(v), text = shares(unit) ? `${Math.round(a * 100)} pts` : unit === 'APF' ? `${Number(a.toPrecision(3)).toLocaleString('en-US')} in APF` : show(a, unit);
  return (/^0(\s|$)/.test(text) ? '' : v > 0 ? '+' : v < 0 ? '-' : '') + text; // a change that rounds to 0 carries no sign
}

/** Per engine: the metrics that move when it is off (STRATUM's other engines still on), with the paired 95% interval of the change. */
export function engines(a: Ablations): string {
  const label = (e: string) => Object.values(a.conditions).find((c) => c.off === e)!.title.replace(/^STRATUM without /, '');
  const base = Object.values(a.conditions).find((c) => c.off === null)!.metrics;
  let own = 0;
  const cross: string[] = [], flat: string[] = [];
  const parts = Object.keys(a.engines).map((e) => {
    const off = Object.values(a.conditions).find((c) => c.off === e)!.metrics;
    const still: number[] = [];
    const items = PROBLEMS.flatMap((p) => {
      const c = a.contribution[e]?.[p.id], s = base[p.id], o = off[p.id];
      if (!c || !s || !o) return [];
      const u = s.unit, moved = c.lo > 0 || c.hi < 0; // the paired interval excludes no change
      if (!moved && change(c.mean, u) === change(0, u)) return (still.push(num(p)), []);
      // contribution is STRATUM minus without, so the change when the engine is off is its negative
      const verdict = !moved ? 'no clear change, the interval spans 0'
        : winner(p.better, o.final.mean, s.final.mean) === 'STRATUM' ? '<b>worse without it</b>' : '<b>better without it: against STRATUM</b>';
      const mine = a.engines[e]!.includes(p.id);
      if (moved) { if (mine) own++; else cross.push(`${label(e)} off moves ${link(p)}`); } // a change counts only when its interval excludes 0
      else flat.push(`${label(e)} off on ${link(p)}`);
      const ci = c.lo === c.hi ? 'the same on every seed' : `95%: ${change(-c.hi, u)} to ${change(-c.lo, u)}`;
      return [`<li data-id="${p.id}"${mine ? '' : ' class="cross"'}>${link(p)}: ${s.name}, ${p.better} is better. STRATUM ${show(s.final.mean, u)}, without ${label(e)} ${show(o.final.mean, u)}: ${verdict}; change ${change(-c.mean, u)} (${ci}).${mine ? '' : ' A cross effect: not one of its own problems.'}</li>`];
    });
    return `<section class="engine" data-engine="${e}"><h3>${label(e)} off</h3>`
      + `<p class="small">Its own problems: ${a.engines[e]!.map((id) => PROBLEMS.findIndex((p) => p.id === id) + 1).join(', ')}. Unchanged when it is off: ${still.join(', ') || 'none'}.</p>`
      + `<ul class="list small">${items.join('')}</ul></section>`;
  });
  return `<p class="small">Seven-day week, ${a.seeds.length} seeds, <strong>SIMULATED</strong>. One engine is switched off by running its problems under the Directorate's rule and the rest under STRATUM's. Each change is paired by seed, with a 95% interval.</p>`
    + `<p class="small"><b>Against STRATUM:</b> the engines barely interact. ${own} of the ${own + cross.length} changes are in the switched engine's own problems, so the ablation shows each problem's rule, not a loop worth more than its parts. Cross effects: ${cross.join('; ') || 'none'}.${flat.length ? ` No clear change, the interval spans 0: ${flat.join('; ')}.` : ''} Where the Directorate's figure is set by its stated rule (problems 1, 7, 8, 10, 13 and 14), switching Witness or Mesh off returns that figure, so the change shows the mechanism, not a measured gain.</p>`
    + `<details class="small"><summary>Each engine, problem by problem</summary>${parts.join('')}</details>`;
}

/** A round number at or above v: the top gridline of a line chart. */
export function nice(v: number): number {
  if (!(v > 0)) return 1;
  const k = 10 ** Math.floor(Math.log10(v));
  return k * [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * k >= v * (1 - 1e-12))!;
}

/** Where each sweep point sits across the chart, 0 to 1; a log scale when the points span ten times or more. */
export function spread(values: number[]): { at: number[]; log: boolean } {
  const lo = Math.min(...values), hi = Math.max(...values), log = lo > 0 && hi / lo >= 10;
  const f = (v: number) => (log ? Math.log(v) : v);
  return { at: values.map((v) => (hi === lo ? 0.5 : (f(v) - f(lo)) / (f(hi) - f(lo)))), log };
}

const tick = (v: number, unit: string) => (unit === 'APF' ? `APF ${v.toLocaleString('en-US')}` : show(v, unit));
const W = 320, L = 20, R = 300, T = 34, B = 132;

/** One swept metric: both rules as lines over the sweep points, 95% whiskers, one shared y axis from 0. */
export function line(sw: Sweep, id: AdapterId): string {
  const p = PROBLEMS.find((q) => q.id === id)!;
  const get = (k: Pol) => sw.points.map((pt) => pt.policies[k][id]!);
  const series = { directorate: get('directorate'), stratum: get('stratum') };
  const { unit, name } = series.stratum[0]!;
  const most = nice(Math.max(...[...series.directorate, ...series.stratum].map((f) => f.final.hi)));
  const top = shares(unit) ? Math.max(1, most) : most;
  const { at, log } = spread(sw.x.values);
  const x = (i: number) => +(L + at[i]! * (R - L)).toFixed(1), y = (v: number) => +(B - (Math.max(0, v) / top) * (B - T)).toFixed(1);
  const xs = sw.x.values;
  const plot = (k: Pol) => {
    const f = series[k];
    const whisk = f.map((m, i) => (m.final.hi > m.final.lo ? `<line class="wh-${k[0]}" x1="${x(i)}" x2="${x(i)}" y1="${y(m.final.lo)}" y2="${y(m.final.hi)}"/>` : '')).join('');
    const marks = f.map((m, i) => `<g transform="translate(${x(i)} ${y(m.final.mean)})"><title>${NAMES[k]} at ${xs[i]}: ${show(m.final.mean, unit)}${m.final.hi > m.final.lo ? ` (95%: ${show(m.final.lo, unit)} to ${show(m.final.hi, unit)})` : ''}</title><circle class="hit" r="12"/>${SHAPE[k]}</g>`).join('');
    return `<polyline class="ln-${k[0]}" points="${f.map((m, i) => `${x(i)},${y(m.final.mean)}`).join(' ')}"/>${whisk}${marks}`;
  };
  const said = (k: Pol) => `${NAMES[k]} ${series[k].map((m, i) => `${show(m.final.mean, unit)} at ${xs[i]}`).join(', ')}`;
  // Against STRATUM: the points it does not win, and its own worst point.
  const lost = xs.filter((_, i) => winner(p.better, series.directorate[i]!.final.mean, series.stratum[i]!.final.mean) !== 'STRATUM');
  const sv = series.stratum.map((m) => m.final.mean), worst = sv.indexOf(p.better === 'higher' ? Math.min(...sv) : Math.max(...sv)), best = sv.indexOf(p.better === 'higher' ? Math.max(...sv) : Math.min(...sv));
  const against = [
    lost.length ? `STRATUM not better at ${lost.join(', ')} ${sw.x.unit}` : '',
    sv[worst] !== sv[best] ? `STRATUM's worst is ${show(sv[worst]!, unit)} at ${xs[worst]} (best ${show(sv[best]!, unit)} at ${xs[best]})` : '',
  ].filter(Boolean);
  const svg = `<svg class="sw-svg" viewBox="0 0 ${W} 172" role="img" aria-label="${name}, SIMULATED. ${said('directorate')}. ${said('stratum')}.">`
    + `<line class="grid" x1="${L}" x2="${R}" y1="${T}" y2="${T}"/><line class="grid" x1="${L}" x2="${R}" y1="${B}" y2="${B}"/>`
    + `<text class="ax" x="${L}" y="${T - 10}">${tick(top, unit)}</text><text class="ax" x="${L - 9}" y="${B + 4}" text-anchor="end">0</text>`
    + xs.map((v, i) => `<text class="ax" x="${x(i)}" y="${B + 18}" text-anchor="middle">${v}</text>`).join('')
    + `<text class="ax" x="${W / 2}" y="${B + 36}" text-anchor="middle">${sw.x.name} (${sw.x.unit})${log ? ', log scale' : ''}</text>`
    + plot('directorate') + plot('stratum')
    // a tie hides the Directorate's square under STRATUM's circle: ring it on top
    + xs.map((_, i) => {
      const d = y(series.directorate[i]!.final.mean);
      return Math.abs(d - y(series.stratum[i]!.final.mean)) < 6 ? `<rect class="tie" x="${x(i) - 8.5}" y="${d - 8.5}" width="17" height="17" rx="1"/>` : '';
    }).join('') + '</svg>';
  const rows = xs.map((v, i) => `<tr><th scope="row">${v}</th>${(['directorate', 'stratum'] as Pol[]).map((k) => {
    const f = series[k][i]!.final;
    return `<td>${show(f.mean, unit)}${f.hi > f.lo ? `<br><span class="muted">95%: ${show(f.lo, unit)} to ${show(f.hi, unit)}</span>` : ''}</td>`;
  }).join('')}</tr>`).join('');
  return `<li class="sw-chart" data-id="${id}"><h4>${link(p)}<br><span class="muted">${name}, ${p.better} is better</span></h4>${svg}`
    + (against.length ? `<p class="small"><b>Against STRATUM:</b> ${against.join('; ')}.</p>` : '')
    + `<details class="small"><summary>Values as a table</summary><table><thead><tr><th scope="col">${sw.x.name}</th><th scope="col">Directorate</th><th scope="col">STRATUM</th></tr></thead><tbody>${rows}</tbody></table></details></li>`;
}

/** One sweep: its stress, a small chart per metric, and the figures reported beside them. */
export function sweep(sw: Sweep, seeds: number): string {
  const beside = sw.metrics.flatMap((id) => Object.entries(sw.points[0]!.policies.stratum[id]?.beside ?? {}).map(([k, b]) =>
    `${b.name}: ${(['directorate', 'stratum'] as Pol[]).map((pol) => {
      const vs = sw.points.map((pt) => show(pt.policies[pol][id]!.beside![k]!.mean, b.unit));
      return `${NAMES[pol]} ${new Set(vs).size === 1 ? `${vs[0]} at every point` : vs.join(', ')}`;
    }).join('; ')}`));
  return `<section class="sweep" data-sweep="${sw.id}"><h3>${sw.title}</h3>`
    + `<p class="small">Varied: ${sw.stress}, at ${sw.x.values.join(', ')} ${sw.x.unit}. Seven-day week, ${seeds} seeds, both rules, means with 95% whiskers, <strong>SIMULATED</strong>.</p>`
    + `<ul class="sw-charts">${sw.metrics.map((id) => line(sw, id)).join('')}</ul>`
    + (beside.length ? `<p class="small">Beside it, at ${sw.x.values.join(', ')}: ${beside.join('. ')}.</p>` : '') + '</section>';
}
