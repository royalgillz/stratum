// The coverage-page charts: scales, labels and the against-STRATUM lines, from the committed evidence files.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { change, dumbbell, engines, line, nice, place, spread, sweep, type Ablations, type Sweeps } from './charts.ts';
import { PROBLEMS } from './problems.ts';

const file = <T>(f: string): T => JSON.parse(readFileSync(`public/evidence/${f}`, 'utf8')); // vitest runs from the repo root
const by = (id: string) => PROBLEMS.find((p) => p.id === id)!;

describe('place', () => {
  it('puts shares on 0 to 100% and other units on 0 to the larger value', () => {
    expect(place(0.4, 0, 0.4, 'share')).toBe(40);
    expect(place(9336, 64904, 9336, 'person-h')).toBe(14.4);
    expect(place(64904, 64904, 9336, 'person-h')).toBe(100);
    expect(place(0, 0, 0, 'h')).toBe(0); // both zero: no division by zero
    expect(place(1.3, 1.3, 0.2, 'ratio')).toBe(100); // a ratio above 1 sets its own top
  });
});

describe('dumbbell', () => {
  it('prints both values, marks the better one by direction, and a missing week as words', () => {
    const lower = dumbbell(by('p03'), { d: 64904, s: 9336, unit: 'person-h' });
    expect(lower).toContain('Directorate: 64,900 person‑h');
    expect(lower).toContain('<b>STRATUM: 9,340 person‑h, better</b>');
    expect(lower.match(/mk-best/g)).toHaveLength(1);
    expect(dumbbell(by('p02'), { d: 0.85, s: 0.66, unit: 'share' })).toContain('<b>Directorate: 85%, better</b>');
    expect(dumbbell(by('p13'), { d: 1, s: 1, unit: 'share' })).toContain('STRATUM: 100%, a tie');
    const none = dumbbell(by('p08'), 'no separations in this script');
    expect(none).toContain('no separations in this script');
    expect(none).not.toContain('<svg');
  });
});

describe('change', () => {
  it('signs a change, in percentage points for shares', () => {
    expect(change(-0.25, 'share')).toBe('-25 pts');
    expect(change(23280, 'person-h')).toBe('+23,300 person‑h');
    expect(change(0, 'share')).toBe('0 pts');
    expect(change(-0.0001, 'share')).toBe('0 pts'); // rounds to nothing: no sign
    expect(change(9990, 'APF')).toBe('+9,990 in APF');
  });
});

describe('nice and spread', () => {
  it('rounds a scale top up to a round number', () => {
    expect(nice(97010)).toBe(100000);
    expect(nice(10000)).toBe(10000);
    expect(nice(0.86)).toBe(1);
    expect(nice(42009)).toBe(50000);
    expect(nice(0)).toBe(1);
  });
  it('spaces points linearly, or on a log scale when they span ten times', () => {
    expect(spread([0, 1, 2, 3, 4, 5])).toEqual({ at: [0, 0.2, 0.4, 0.6, 0.8, 1], log: false });
    const o = spread([2, 5, 10, 20, 40]);
    expect(o.log).toBe(true);
    expect(o.at[2]).toBeCloseTo(Math.log(5) / Math.log(20));
  });
});

describe('engines, from ablations.json', () => {
  const html = engines(file<Ablations>('ablations.json'));
  it('lists what each engine moves, with its own problems apart from cross effects', () => {
    expect(html.match(/<section class="engine"/g)).toHaveLength(3);
    // Witness 5, Mesh 3, Fair Share 7 own problems moved; Fair Share off also moves p01. p09's interval spans 0: listed apart, not counted
    expect(html).toContain('15 of the 16 changes are in the switched engine');
    expect(html).toMatch(/Cross effects: Fair Share off moves <a [^>]+>1\. [^<]+<\/a>\. No clear change, the interval spans 0: Fair Share off on <a [^>]+>9\. /);
    expect(html.match(/class="cross"/g)).toHaveLength(2);
    expect(html).toMatch(/STRATUM 0 person‑h, without Witness 23,300 person‑h: <b>worse without it<\/b>; change \+23,300 person‑h \(95%: \+22,100 person‑h to \+24,500 person‑h\)/);
    expect(html).toMatch(/9\. Track the real outbreak, route supplies<\/a>: [^<]*STRATUM 20%, without Fair Share 16%: no clear change, the interval spans 0; change -4 pts \(95%: -13 pts to \+6 pts\)/);
    expect(html).toContain('Unchanged when it is off: 2, 3, 5, 6, 7, 8, 10, 11, 12, 15.'); // Witness off
  });
});

describe('sweeps, from sweeps.json', () => {
  const s = file<Sweeps>('sweeps.json');
  it('draws one chart per swept metric, both rules, and says where STRATUM is not better', () => {
    const crews = s.sweeps.find((w) => w.id === 'lying-crews')!;
    const p13 = line(crews, 'p13');
    expect(p13.match(/<polyline/g)).toHaveLength(2);
    expect(p13).toContain('STRATUM not better at 3, 4, 5 crews of 5');
    expect(p13).toContain('aria-label="wrong-band rate, SIMULATED.');
    expect(p13.match(/<rect class="tie"/g)).toHaveLength(3); // both rules at 100% at 3, 4 and 5 crews: the hidden square is ringed
    expect(p13).toContain('x="11" y="136" text-anchor="end">0</text>'); // the 0 tick clear of the first marker at x=20
    const all = sweep(crews, s.seeds.length);
    expect(all.match(/<svg class="sw-svg"/g)).toHaveLength(2);
    expect(all).toContain('trial breaches: Directorate 0 at every point; STRATUM 0, 0, 0, 1, 1, 1');
    const outbreak = line(s.sweeps.find((w) => w.id === 'outbreak')!, 'p09');
    expect(outbreak).toContain(', log scale');
    expect(outbreak).toContain("STRATUM's worst is 36% at 5 (best 11% at 40)");
  });
});
