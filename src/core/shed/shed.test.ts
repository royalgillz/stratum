import { describe, expect, it } from 'vitest';
import type { Label, Tier } from '../contracts.ts';
import { createShedLedger, type ShedReport } from './shed.ts';

const MIN = 60000;
const T0 = 29_000_000; // a Unix minute
const ms = (minute: number, sec = 0) => minute * MIN + sec * 1000;
// A REPORT for `level` from member `member` of key set `keySet`, at packet minute `minute`, power off unless flags say otherwise.
const off = (minute: number, level: number, member: number, keySet = 'public', extra: Partial<ShedReport> = {}): ShedReport => ({
  type: 2, minute, keySet, duplicate: false,
  payload: { member, code: 0, level, sector: 0, flags: 0, value: 0 },
  ...extra,
});
const on = (minute: number, level: number, member: number): ShedReport => {
  const r = off(minute, level, member);
  return { ...r, payload: { ...r.payload, flags: 1 } };
};
// Three distinct senders report `level` off at `minute`.
const cut3 = (minute: number, level: number) => [0, 1, 2].map((m) => off(minute, level, m));
type Ledger = ReturnType<typeof createShedLedger>;
// Three other senders report `level` powered every minute from T0 - 5 to T0 + 199, so every event there observes it.
const watch = (s: Ledger, level = 1) => {
  for (let m = T0 - 5; m < T0 + 200; m++) for (const k of [10, 11, 12]) s.report(on(m, level, k));
};
const later = ms(T0 + 1000);

describe('shed ledger', () => {
  // @spec SHED-001
  it('SHED-001 opens AMBER and RED events on rises', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    watch(s);
    s.tier(ms(T0, 30), 'AMBER'); // AMBER event at T0
    s.tier(ms(T0 + 1), 'RED'); // RED event at T0 + 1
    s.tier(ms(T0 + 2), 'GREEN');
    s.tier(ms(T0 + 20), 'RED'); // GREEN to RED: one AMBER and one RED event at T0 + 20
    s.tier(ms(T0 + 21), 'GREEN');
    expect(s.odds(1, 'AMBER', later).events).toBe(2);
    expect(s.odds(1, 'RED', later).events).toBe(2);
    // a rise from AMBER to RED opens a RED event only
    const r = createShedLedger({ label: 'SIMULATED' });
    watch(r);
    r.tier(ms(T0), 'AMBER');
    r.tier(ms(T0 + 15), 'RED');
    r.tier(ms(T0 + 16), 'GREEN');
    expect(r.odds(1, 'AMBER', later).events).toBe(1);
    expect(r.odds(1, 'RED', later).events).toBe(1);
    // event minute is floor(nowMs / 60000): a cut at T0 counts, one at T0 - 1 does not
    const t = createShedLedger({ label: 'SIMULATED' });
    t.tier(ms(T0, 59), 'AMBER');
    t.tier(ms(T0 + 1), 'GREEN');
    cut3(T0, 4).forEach((x) => t.report(x));
    cut3(T0 - 1, 5).forEach((x) => t.report(x));
    expect(t.odds(4, 'AMBER', later).cuts).toBe(1);
    expect(t.odds(5, 'AMBER', later).cuts).toBe(0);
    // first call AMBER counts as a rise from GREEN
    const u = createShedLedger({ label: 'LIVE' });
    watch(u);
    u.tier(ms(T0), 'AMBER');
    u.tier(ms(T0 + 1), 'GREEN');
    expect(u.odds(1, 'AMBER', later).events).toBe(1);
    expect(u.odds(1, 'RED', later).events).toBe(0);
  });

  // @spec SHED-002
  it('SHED-002 ignores repeats and falls, and a rise before the end continues the event', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    watch(s);
    s.tier(ms(T0), 'AMBER');
    s.tier(ms(T0, 30), 'AMBER'); // repeat
    s.tier(ms(T0 + 1), 'GREEN'); // fall: AMBER event ends at T0 + 11
    s.tier(ms(T0 + 10, 59), 'AMBER'); // minute T0 + 10, before the end: continues
    s.tier(ms(T0 + 12), 'GREEN'); // ends at T0 + 22
    s.tier(ms(T0 + 22), 'AMBER'); // at the end minute: a new event
    s.tier(ms(T0 + 23), 'GREEN');
    expect(s.odds(1, 'AMBER', later).events).toBe(2);
    // the tier is still updated when no event opens: the repeat at T0 + 15 is not a rise
    const t = createShedLedger({ label: 'SIMULATED' });
    watch(t);
    t.tier(ms(T0), 'AMBER');
    t.tier(ms(T0 + 1), 'GREEN');
    t.tier(ms(T0 + 2), 'AMBER'); // continues the event, tier is now AMBER
    t.tier(ms(T0 + 15), 'AMBER');
    t.tier(ms(T0 + 16), 'GREEN');
    expect(t.odds(1, 'AMBER', later).events).toBe(1);
    // the tracker restarts at GREEN when the hum returns after a cut: no new event
    const g = createShedLedger({ label: 'SIMULATED' });
    g.tier(ms(T0), 'RED'); // AMBER and RED events at T0
    cut3(T0 + 3, 5).forEach((x) => g.report(x)); // level 5 cut, its phones hear NO HUM (no tier calls)
    g.tier(ms(T0 + 40), 'GREEN'); // power back, both events end at T0 + 50
    g.tier(ms(T0 + 40, 1), 'AMBER'); // grid still AMBER: continues the AMBER event
    g.tier(ms(T0 + 60), 'GREEN');
    expect(g.odds(5, 'AMBER', later)).toMatchObject({ cuts: 1, events: 1 });
    expect(g.odds(5, 'RED', later)).toMatchObject({ cuts: 1, events: 1 });
  });

  // @spec SHED-003
  it('SHED-003 rejects bad tier calls and keeps state', () => {
    const s = createShedLedger({ label: 'LIVE' });
    watch(s);
    s.tier(ms(T0 + 5), 'GREEN');
    expect(() => s.tier(ms(T0 + 4), 'AMBER')).toThrow(RangeError);
    expect(() => s.tier(NaN, 'AMBER')).toThrow(RangeError);
    expect(() => s.tier(Infinity, 'AMBER')).toThrow(RangeError);
    expect(() => s.tier(ms(T0 + 6), 'BLUE' as Tier)).toThrow(RangeError);
    expect(() => s.tier(ms(T0 + 6), 'toString' as Tier)).toThrow(RangeError);
    expect(() => s.tier(ms(T0 + 6), 'AMBER', 'FAKE' as Label)).toThrow(RangeError);
    expect(() => s.tier(ms(T0 + 4), 'AMBER', 'SIMULATED')).toThrow(RangeError);
    expect(s.odds(1, 'AMBER', later)).toMatchObject({ events: 0, label: 'LIVE' });
    s.tier(ms(T0 + 5), 'AMBER'); // time unchanged by the failures, tier still GREEN
    s.tier(ms(T0 + 6), 'GREEN');
    expect(s.odds(1, 'AMBER', later)).toMatchObject({ events: 1, label: 'LIVE' });
  });

  // @spec SHED-004
  it('SHED-004 stores only OK or REPORT packets that are new and in range, with their power state', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    expect(s.report(off(T0, 3, 0))).toBe(true);
    expect(s.report(off(T0, 3, 1, 'fam', { type: 0 }))).toBe(true); // OK
    for (const type of [1, 3, 4, 5, 6, 7]) expect(s.report(off(T0, 3, 9, 'public', { type }))).toBe(false);
    expect(s.report(off(T0, 3, 9, 'public', { duplicate: true }))).toBe(false);
    for (const level of [0, 7, 15, 2.5, NaN]) expect(s.report(off(T0, level, 9))).toBe(false);
    expect(s.report(off(T0 + 0.5, 3, 9))).toBe(false);
    expect(s.report(off(NaN, 3, 9))).toBe(false);
    // power-on is stored too (flags bit 0 = 1), other flag bits do not matter
    expect(s.report(on(T0, 3, 5))).toBe(true);
    expect(s.report(off(T0, 3, 2, 'public', { payload: { member: 2, code: 0, level: 3, sector: 0, flags: 2, value: 0 } }))).toBe(true);
    // the rejected ones were not stored: power-off senders 0, fam/1 and 2 make 3; sender 5 is power on
    s.tier(ms(T0), 'AMBER');
    s.tier(ms(T0 + 1), 'GREEN');
    expect(s.odds(3, 'AMBER', later)).toMatchObject({ cuts: 1, events: 1 });
    const t = createShedLedger({ label: 'SIMULATED' });
    t.tier(ms(T0), 'AMBER');
    t.tier(ms(T0 + 1), 'GREEN');
    t.report(off(T0, 3, 0));
    t.report(off(T0, 3, 1));
    t.report(off(T0, 3, 9, 'public', { duplicate: true }));
    t.report(on(T0, 3, 9));
    expect(t.odds(3, 'AMBER', later)).toMatchObject({ cuts: 0, events: 1 }); // 3 senders observed, 2 off
  });

  // @spec SHED-005
  it('SHED-005 needs 3 distinct senders inside the window, to observe and to count a cut', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    s.tier(ms(T0), 'AMBER');
    s.tier(ms(T0, 30), 'GREEN'); // window [T0, T0 + 10)
    // level 1: one sender repeated five times plus one more: 2 senders, not even observed
    for (let i = 0; i < 5; i++) s.report(off(T0 + i, 1, 7));
    s.report(off(T0, 1, 8));
    // level 2: same member byte under three key sets: 3 senders, cut
    ['a', 'b', 'public'].forEach((k) => s.report(off(T0 + 9, 2, 1, k)));
    // level 3: two members of one family plus one public: 3 senders, cut
    s.report(off(T0, 3, 0, 'fam'));
    s.report(off(T0, 3, 1, 'fam'));
    s.report(off(T0, 3, 0));
    // level 4: third sender at minute T0 + 10, outside the window
    s.report(off(T0, 4, 0));
    s.report(off(T0 + 5, 4, 1));
    s.report(off(T0 + 10, 4, 2));
    // level 5: two off and one on: observed, not cut
    s.report(off(T0, 5, 0));
    s.report(off(T0, 5, 1));
    s.report(on(T0, 5, 2));
    // level 6: only two phones, both off in every way: no number, not a low one
    s.report(off(T0, 6, 0));
    s.report(off(T0, 6, 1));
    const r = [1, 2, 3, 4, 5, 6].map((l) => s.odds(l, 'AMBER', later));
    expect(r.map((x) => x.cuts)).toEqual([0, 1, 1, 0, 0, 0]);
    expect(r.map((x) => x.events)).toEqual([0, 1, 1, 0, 1, 0]);
  });

  // @spec SHED-006
  it('SHED-006 counts closed observed events and applies (c + 1) / (e + 2)', () => {
    const s = createShedLedger({ label: 'REPLAY' });
    watch(s, 5);
    watch(s, 2);
    for (let k = 0; k < 4; k++) {
      s.tier(ms(T0 + 20 * k), 'RED');
      s.tier(ms(T0 + 20 * k + 1), 'GREEN'); // ends at T0 + 20k + 11
      if (k < 3) cut3(T0 + 20 * k + 2, 5).forEach((r) => s.report(r));
    }
    expect(s.odds(5, 'RED', later)).toEqual({ p: 4 / 6, cuts: 3, events: 4, label: 'REPLAY' });
    expect(s.odds(5, 'AMBER', later).p).toBeCloseTo(4 / 6, 15); // GREEN to RED is also AMBER-or-worse
    expect(s.odds(2, 'RED', later)).toEqual({ p: 1 / 6, cuts: 0, events: 4, label: 'REPLAY' });
    expect(s.odds(4, 'RED', later)).toEqual({ p: 1 / 2, cuts: 0, events: 0, label: 'REPLAY' }); // never observed
    // the last event (minute T0 + 60) closes exactly at (T0 + 71) * 60000
    expect(s.odds(5, 'RED', ms(T0 + 71) - 1).events).toBe(3);
    expect(s.odds(5, 'RED', ms(T0 + 71)).events).toBe(4);
    // a cut inside an open event is not counted until it ends
    expect(s.odds(5, 'RED', ms(T0 + 45))).toEqual({ p: 3 / 4, cuts: 2, events: 2, label: 'REPLAY' });
  });

  // @spec SHED-007
  it('SHED-007 gives exactly 1/2 with no closed observed event', () => {
    const s = createShedLedger({ label: 'LIVE' });
    expect(s.odds(6, 'RED', later)).toEqual({ p: 0.5, cuts: 0, events: 0, label: 'LIVE' });
    s.tier(ms(T0), 'RED');
    cut3(T0, 6).forEach((r) => s.report(r));
    expect(s.odds(6, 'RED', later)).toEqual({ p: 0.5, cuts: 0, events: 0, label: 'LIVE' }); // still RED: open
    s.tier(ms(T0 + 1), 'GREEN');
    expect(s.odds(6, 'RED', ms(T0 + 10, 59))).toEqual({ p: 0.5, cuts: 0, events: 0, label: 'LIVE' });
  });

  // @spec SHED-008
  it('SHED-008 rejects bad odds queries', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    for (const level of [0, 7, 2.5, NaN]) expect(() => s.odds(level, 'RED', later)).toThrow(RangeError);
    expect(() => s.odds(1, 'GREEN' as 'RED', later)).toThrow(RangeError);
    expect(() => s.odds(1, 'toString' as 'RED', later)).toThrow(RangeError);
    expect(() => s.odds(1, 'RED', NaN)).toThrow(RangeError);
    expect(() => s.odds(1, 'RED', -Infinity)).toThrow(RangeError);
  });

  // @spec SHED-009
  it('SHED-009 does not depend on report arrival order', () => {
    const tiers: [number, Tier][] = [[ms(T0), 'AMBER'], [ms(T0 + 2), 'RED'], [ms(T0 + 5), 'GREEN'], [ms(T0 + 30), 'AMBER'], [ms(T0 + 31), 'GREEN']];
    const reports = [...cut3(T0 + 3, 5), off(T0 + 31, 2, 0), off(T0 + 32, 2, 1), off(T0 + 40, 2, 2), off(T0 + 1, 1, 0), off(T0 + 2, 1, 0), on(T0 + 4, 1, 1), on(T0 + 4, 1, 2)];
    const run = (order: number[], at: number) => {
      const s = createShedLedger({ label: 'SIMULATED' });
      let i = 0;
      for (const [t, tier] of tiers) {
        while (i < order.length && i < at) s.report(reports[order[i++]]);
        s.tier(t, tier);
        at += 2;
      }
      while (i < order.length) s.report(reports[order[i++]]);
      return [1, 2, 5].flatMap((l) => (['AMBER', 'RED'] as const).map((t) => s.odds(l, t, later)));
    };
    const base = run([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0);
    expect(base.map((r) => r.cuts)).toEqual([0, 0, 1, 0, 1, 1]);
    expect(base.map((r) => r.events)).toEqual([1, 1, 1, 0, 1, 1]);
    expect(run([9, 8, 7, 6, 5, 4, 3, 2, 1, 0], 0)).toEqual(base);
    expect(run([3, 0, 6, 9, 1, 4, 7, 2, 8, 5], 3)).toEqual(base);
    expect(run([5, 2, 7, 4, 9, 1, 6, 3, 8, 0], 99)).toEqual(base); // all after the events ended
  });

  // @spec SHED-010
  it('SHED-010 validates the label and takes every time from the caller', () => {
    expect(() => createShedLedger({ label: 'LIVEISH' as Label })).toThrow(RangeError);
    for (const label of ['LIVE', 'REPLAY', 'SIMULATED'] as const) expect(createShedLedger({ label }).odds(1, 'RED', 0).label).toBe(label);
    // same calls give the same answer at any wall-clock time: nothing reads a clock
    const run = () => {
      const s = createShedLedger({ label: 'SIMULATED' });
      s.tier(ms(T0), 'RED');
      s.tier(ms(T0 + 1), 'GREEN');
      cut3(T0, 2).forEach((r) => s.report(r));
      return s.odds(2, 'RED', later);
    };
    expect(run()).toEqual(run());
    expect(run()).toEqual({ p: 2 / 3, cuts: 1, events: 1, label: 'SIMULATED' });
  });

  // @spec SHED-011
  it('SHED-011 keeps an event open while the tier holds, and 10 minutes after it falls', () => {
    const s = createShedLedger({ label: 'SIMULATED' });
    s.tier(ms(T0), 'AMBER'); // AMBER event at T0
    s.tier(ms(T0 + 5), 'RED'); // RED event at T0 + 5, stays RED
    cut3(T0 + 20, 5).forEach((r) => s.report(r)); // cut 15 minutes into the RED event
    s.tier(ms(T0 + 30, 40), 'AMBER'); // RED event ends at T0 + 40
    s.tier(ms(T0 + 35), 'GREEN'); // AMBER event ends at T0 + 45
    cut3(T0 + 39, 4).forEach((r) => s.report(r)); // last minute of the RED window
    cut3(T0 + 40, 3).forEach((r) => s.report(r)); // past the RED window, inside the AMBER one
    cut3(T0 + 45, 2).forEach((r) => s.report(r)); // past both
    const c = (t: 'AMBER' | 'RED') => [2, 3, 4, 5].map((l) => s.odds(l, t, later).cuts);
    expect(c('RED')).toEqual([0, 0, 1, 1]);
    expect(c('AMBER')).toEqual([0, 1, 1, 1]);
    expect(s.odds(5, 'RED', ms(T0 + 40) - 1).events).toBe(0);
    expect(s.odds(5, 'RED', ms(T0 + 40)).events).toBe(1);
    expect(s.odds(5, 'AMBER', ms(T0 + 45) - 1).events).toBe(0);
    expect(s.odds(5, 'AMBER', ms(T0 + 45)).events).toBe(1);
  });

  // @spec SHED-012
  it('SHED-012 reports the weakest label among the inputs', () => {
    const s = createShedLedger({ label: 'LIVE' });
    s.tier(ms(T0), 'RED');
    s.tier(ms(T0 + 1), 'GREEN');
    cut3(T0, 5).forEach((r) => s.report(r));
    expect(s.odds(5, 'RED', later).label).toBe('LIVE');
    expect(() => s.report(off(T0, 5, 7), 'FAKE' as Label)).toThrow(RangeError);
    expect(s.report(off(T0, 9, 7), 'SIMULATED')).toBe(false); // rejected: label unchanged
    expect(s.odds(5, 'RED', later).label).toBe('LIVE');
    expect(s.report(off(T0, 5, 7), 'REPLAY')).toBe(true);
    expect(s.odds(5, 'RED', later).label).toBe('REPLAY');
    s.tier(ms(T0 + 30), 'GREEN', 'SIMULATED');
    expect(s.odds(1, 'AMBER', later).label).toBe('SIMULATED');
    s.report(off(T0, 5, 8), 'LIVE'); // a stronger label never strengthens the answer
    expect(s.odds(5, 'RED', later).label).toBe('SIMULATED');
  });
});
