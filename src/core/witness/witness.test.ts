import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../contracts.ts';
import { createWitness } from './witness.ts';

const fresh = () => ({ measured: [] as LedgerEntry[], official: [] as LedgerEntry[] });
const make = () => {
  const l = fresh();
  let t = 0;
  const w = createWitness({ now: () => t, ledger: l });
  return { l, w, at: (x: number) => { t = x; } };
};

describe('witness', () => {
  // @spec WIT-009
  it('averages latest measured minus latest official over places that have both', () => {
    const { w } = make();
    expect(w.gap('toc')).toBeNaN();
    w.observe('toc', 'A', 5, 'crew');
    expect(w.gap('toc')).toBeNaN(); // measured only
    w.observe('toc', 'A', 4, 'official');
    w.observe('toc', 'B', 10, 'official'); // official only: ignored
    w.observe('toc', 'C', 2, 'crew');
    w.observe('toc', 'C', 1, 'official:x');
    expect(w.gap('toc')).toBe(1); // A: 1, C: 1
    w.observe('toc', 'A', 8, 'crew'); // latest wins: A is now 4
    w.observe('toc', 'C', 3, 'crew2');
    expect(w.gap('toc')).toBe(3); // (4 + 2) / 2
    w.observe('toc', 'A', 6, 'official');
    expect(w.gap('toc')).toBe(2); // (2 + 2) / 2
    expect(w.gap('cond')).toBeNaN();
  });

  // @spec WIT-010
  it('digest is the first 16 bytes of the measured head, genesis when empty; head gives both chains', () => {
    const { w, l } = make();
    const genesis = w.head('measured');
    expect(genesis).toMatch(/^[0-9a-f]{64}$/);
    expect(w.head('official')).not.toBe(genesis);
    expect(w.digest()).toBe(genesis.slice(0, 32));
    w.observe('k', 'w', 1, 'crew');
    w.observe('k', 'w', 2, 'official');
    expect(w.head('measured')).toBe(l.measured[0]!.hash);
    expect(w.head('official')).toBe(l.official[0]!.hash);
    expect(w.digest()).toBe(l.measured[0]!.hash.slice(0, 32));
    expect(w.digest()).toMatch(/^[0-9a-f]{32}$/);
  });

  // @spec WIT-005
  it('runs the detector on measured entries only, and records events in order of detection', () => {
    const { w, at } = make();
    for (let i = 0; i < 24; i++) { at(i); w.observe('cond', 'A', 10, 'crew'); }
    for (let i = 0; i < 3; i++) { at(30 + i); w.observe('cond', 'A', 99, 'official'); }
    expect(w.events()).toEqual([]);
    for (let i = 0; i < 3; i++) { at(40 + i); w.observe('cond', 'A', 99, 'crew'); }
    expect(w.events()).toHaveLength(1);
    expect(w.events()[0]).toMatchObject({ tStart: 40, tDetect: 42 });
  });

  // @spec WIT-012
  it('is deterministic, and replaying a restored ledger rebuilds the same events', () => {
    const feed = (m: ReturnType<typeof make>) => {
      for (let i = 0; i < 40; i++) { m.at(i * 60); m.w.observe('turb', 'L3S4', i < 30 ? 1 : 9, i % 7 === 0 ? 'crew-a' : 'crew-b'); }
      m.at(3000); m.w.observe('turb', 'L3S4', 1, 'official');
    };
    const a = make(), b = make();
    feed(a); feed(b);
    expect(b.l).toEqual(a.l);
    expect(b.w.events()).toEqual(a.w.events());
    expect(a.w.events()).toHaveLength(1);
    const restored = createWitness({ now: () => 4000, ledger: structuredClone(a.l) });
    expect(restored.events()).toEqual(a.w.events());
    expect(restored.digest()).toBe(a.w.digest());
  });
});
