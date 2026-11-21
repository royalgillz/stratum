// The fifteen problems as the District 7 page and the coverage matrix print them. Tiers and labels follow
// docs/coverage.md; metric direction follows docs/intent/adapters/adapters-design.md. Outside src/core.
import type { AdapterId } from '../core/contracts.ts';
import { NO_PROOF } from '../core/adapters/p14.ts';
import type { ScenarioEvent } from '../core/scenario/types.ts';

export type Better = 'higher' | 'lower';
export interface Problem {
  id: AdapterId;
  title: string;
  tier: string; // as docs/coverage.md states it; badges are the tier words in it
  mechanism: string;
  metric: string; // the adapter's metric in plain words
  better: Better;
  labels: string;
}

const p = (id: AdapterId, title: string, tier: string, mechanism: string, metric: string, better: Better, labels: string): Problem =>
  ({ id, title, tier, mechanism, metric, better, labels });

export const PROBLEMS: Problem[] = [
  p('p01', 'Warn before power or air cuts', 'Live (power); air: fan-stop alert tested on a phone at 3 m', 'A phone hears the grid hum sag (GREEN, AMBER, RED); neighbours\' power reports say which level is cut', 'share of power cuts warned at least 10 min ahead', 'higher', 'LIVE (phone); REPLAY (ENF-WHU); SIMULATED (district)'),
  p('p02', 'Share power, water, food fairly', 'Modelled, real requests', 'Fair Share: life floors first, then raise the worst-off, same supply and same trigger', 'share of need met (power, water, food) for the worst-off tenth of residents', 'higher', 'LIVE (requests); SIMULATED (district)'),
  p('p03', 'Keep lower levels livable', 'Modelled', 'Fair Share cooling with a floor that cools a refuge room in every sector', 'person-hours (people times hours) above the 27.5 °C wet-bulb heat limit', 'lower', 'SIMULATED (district)'),
  p('p04', 'Catch bad water before people drink it', 'Modelled, real data, real reports', 'Witness (STRATUM\'s change detector) on every recycler channel, HOLD WATER for the level', 'person-hours of unsafe water drunk', 'lower', 'LIVE (reports); REPLAY (GECCO 2018); SIMULATED (district)'),
  p('p05', 'Keep tunnels safe to live in and move through', 'Modelled, real reports', 'Fair Share pump power with full floors for tunnels whose loss strands a neighbourhood', 'person-hours stranded by floods', 'lower', 'LIVE (reports); SIMULATED (district)'),
  p('p06', 'Find, make or share space', 'Modelled', 'Rooms pooled per sector and slept in by shift; the night shift rotated by debt, households whole', 'sleeping floor per sleeper on the busiest shift', 'higher', 'SIMULATED (district)'),
  p('p07', 'Organize without the network', 'Live', '25-byte signed packets carried by sound, relayed sector to sector (at most 4 hops)', 'share of messages delivered within 60 min', 'higher', 'LIVE (phone); SIMULATED (district)'),
  p('p08', 'Reconnect families', 'Live', 'OK beacons under a family key, relayed by strangers\' phones, shown on a family board', 'mean hours until a separated member\'s status is known', 'lower', 'LIVE (phone); SIMULATED (district)'),
  p('p09', 'Track the real outbreak, route supplies', 'Modelled, real reports', 'Chapman estimate (a case count from how much two lists overlap) from the clinic list and residents\' reports; medicine follows the estimate', 'relative error of the case count acted on', 'lower', 'LIVE (reports); SIMULATED (district)'),
  p('p10', 'Basic care for people who cannot reach a clinic', 'Live (tap count, danger-sign RED and medicine request tested on the phone), Modelled (delivery)', 'Breath Count on the phone; requests over the mesh to two pop-up care points, RED before AMBER', 'median hours from a RED request to first care', 'lower', 'LIVE (aid); SIMULATED (district)'),
  p('p11', 'Track and treat life without sunlight', 'Modelled', 'Whole 4 h bright-light sessions rotated by debt; grow rooms count as bright rooms', 'share of person-days with 4 h of daytime light', 'higher', 'SIMULATED (district)'),
  p('p12', 'Grow and share neighbourhood food', 'Modelled, real requests', 'Farm deliveries shared over every level, a cut-off one included; stores top up to the floor only', 'days the food floor held after a farm cut-off', 'higher', 'LIVE (requests); SIMULATED (district)'),
  p('p13', 'Prove whether the surface is safe, tell everyone', 'Modelled (digest sent by sound to a phone, LIVE)', 'Witness quorum over independent crews\' readings gives an exposure band, beside the official verdict', 'share of reading rounds with the wrong band', 'lower', 'SIMULATED (district)'),
  p('p14', 'Which option works, who goes first', 'Modelled', 'Trials staged 1 h to 30 days with stop rules; volunteers by lottery, one stage each', 'assigned protection factor (APF: how many times a mask or suit cuts what you breathe in) a planned 30-day trial would prove, worked out on paper, not run (a lower APF proves a lighter option)', 'lower', 'SIMULATED (district)'),
  p('p15', 'Plan the mass return', 'Modelled', 'Daily return slots by lottery, with debt that starts higher for deeper levels, families whole', 'the worst level\'s mean wait for a slot', 'lower', 'SIMULATED (district)'),
];

export const TIERS = ['Live', 'Modelled', 'Thin', 'Roadmap'] as const;
export const badges = (tier: string) => TIERS.filter((t) => tier.includes(t));

/** A metric value in plain units: shares and ratios as percentages, nothing proven as words. */
export function show(value: number, unit: string): string {
  if (unit === 'APF') return value >= NO_PROOF ? 'none proven' : `APF ${Number(value.toPrecision(3)).toLocaleString('en-US')}`;
  if (unit === 'share' || unit === 'ratio') return `${Math.round(value * 100)}%`;
  // U+2011, a non-breaking hyphen: a narrow cell never splits the unit
  const units: Record<string, string> = { 'person-h': ' person\u2011h', h: ' h', days: ' days', m2: ' m²', count: '' };
  const n = Number(value.toPrecision(3)).toLocaleString('en-US'), u = units[unit] ?? ` ${unit}`;
  return n + (n === '1' ? u.replace(/s$/, '') : u); // 1 household, 1 day
}

/** Why the Directorate's figure is 0 under its own rule, printed beside a 0 so it is not read as a measured result.
 *  p01: only STRATUM warns (p01.ts counts a warning under 'stratum' only). p07: the Directorate delivers by its 06:00 bulletin only. */
export const ZERO_BY_RULE: Partial<Record<AdapterId, string>> = { p01: 'no tool, by rule', p07: '06:00 bulletin only' };

/** Which policy did better on one metric, read by its direction. */
export function winner(better: Better, directorate: number, stratum: number): 'STRATUM' | 'Directorate' | 'tie' {
  const d = better === 'higher' ? stratum - directorate : directorate - stratum;
  return Math.abs(d) <= 1e-9 * Math.max(1, Math.abs(directorate), Math.abs(stratum)) ? 'tie' : d > 0 ? 'STRATUM' : 'Directorate';
}

// The script events each metric waits on: before the first, the metric reports a placeholder 0, not a result.
const DRIVER: Partial<Record<AdapterId, [ScenarioEvent['type'][], string]>> = {
  p01: [['shortfall', 'trip'], 'no power cuts'],
  p04: [['contamination'], 'no bad water'], // short words: a phone's result column is about 90 px wide
  p07: [['separate'], 'no separations, so no OK messages'],
  p08: [['separate'], 'no separations'],
  p09: [['outbreak'], 'no outbreak'],
  p10: [['care'], 'no care requests'],
  p12: [['farm-cut'], 'no farm cut-off'],
  p13: [['surface'], 'no surface readings'],
};

// p09: the seven-day outbreak is small, so its result comes from the 30-day run (evidence design, "p09: outbreak").
export const NOISE = 'small outbreak: noise';

/** Why a metric has no result at world time t, or null when it has one. Before the first step every metric is a placeholder. */
export function noEvent(id: AdapterId, events: ScenarioEvent[], t: number): string | null {
  if (t === 0) return 'not started';
  const d = DRIVER[id];
  if (!d) return null;
  const of = events.filter((e) => d[0].includes(e.type));
  return of.some((e) => e.atH * 3600 <= t) ? null : `${d[1]} ${of.length ? 'yet' : 'in this script'}`;
}
