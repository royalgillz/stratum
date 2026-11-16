// The district page's pure steps: the gateway's packet-to-message rule and the worker's snapshot of a run.
import { describe, expect, it } from 'vitest';
import { createDecoder, encode, TYPES } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { createRun } from '../core/scenario/run.ts';
import { sevenDay } from '../core/scenario/seven-day.ts';
import { toMessage } from './gateway.ts';
import { audioClock, view, type AudioClock } from './snapshot.ts';

const WORDS = 'abandon ability able about above absent';
const now = Date.UTC(2026, 10, 16, 12, 0);
const payload = { member: 42, code: 0, level: 5, sector: 1, flags: 1, value: 0 };
const ok = (k: KeySet, nonce = 7, type: number = TYPES.OK) => encode(k, { type, minute: Math.floor(now / 60000), nonce, hops: 3, payload });

describe('gateway toMessage', () => {
  it('turns a verified family OK into a LIVE message for the demo household, once', async () => {
    const family = (await deriveKeys(WORDS, 'family')) as KeySet;
    const decode = createDecoder([family], await publicKeys());
    const bytes = await ok(family);
    const r = toMessage(await decode(bytes, now), bytes);
    expect(r.note).toBe('Verified OK from member 42');
    expect(r.message).toEqual({ at: 0, bytes, heard: { type: TYPES.OK, keySet: 'family', minute: Math.floor(now / 60000), payload, label: 'LIVE' } });
    const again = toMessage(await decode(bytes, now), bytes); // a relayed copy of the same packet
    expect(again.message).toBeUndefined();
    expect(again.note).toMatch(/^Repeat of OK from member 42, heard 2 times/);
  });

  it('injects nothing for another family, damaged bytes or a public packet', async () => {
    const family = (await deriveKeys(WORDS, 'family')) as KeySet;
    const stranger = (await deriveKeys('zoo zone youth young yellow year', 'family')) as KeySet;
    const pub = await publicKeys();
    const decode = createDecoder([family], pub);
    const theirs = await ok(stranger);
    expect(toMessage(await decode(theirs, now), theirs)).toEqual({ note: 'Rejected: not this family (or damaged)' });
    const bad = (await ok(family, 9)).map((b, i) => (i === 20 ? b ^ 1 : b));
    expect(toMessage(await decode(bad, now), bad)).toEqual({ note: 'Rejected: mac' });
    const alert = await ok(pub, 11, TYPES.GRID_ALERT);
    const r = toMessage(await decode(alert, now), alert);
    expect(r.message).toBeUndefined();
    expect(r.note).toBe('Public GRID ALERT from member 42: not a family message, not added to the board');
  });
});

describe('snapshot view', () => {
  it('reports 24 sectors, all eight metrics, and a LIVE OK on the demo board after the next step', () => {
    const run = createRun(sevenDay, 1, 'stratum', { check: false });
    run.kernel.run(3 * 3600);
    const v = view(run, sevenDay.demo.id);
    expect(v.t).toBe(3 * 3600);
    expect(v.cells).toHaveLength(24);
    expect(v.cells.every((c) => c.served === 1 && !c.flooded && !c.unsafe)).toBe(true); // nothing has gone wrong by hour 3
    expect(Object.keys(v.metrics)).toEqual(['p01', 'p02', 'p03', 'p04', 'p05', 'p07', 'p08', 'p09']);
    expect(Object.values(v.metrics).every((m) => m.label === 'SIMULATED')).toBe(true);
    expect(v.board).toEqual({}); // the demo family is never separated, so only a real phone reaches its board

    run.inject({ at: 0, bytes: new Uint8Array(25), heard: { type: TYPES.OK, keySet: 'family', minute: 29_000_000, payload, label: 'LIVE' } });
    run.kernel.step();
    expect(view(run, sevenDay.demo.id).board).toEqual({ 42: { at: 3 * 3600, minute: 29_000_000, level: 5, sector: 1, label: 'LIVE' } });
  });

  it('marks a cut, a flood and unsafe water from the world the adapters write', () => {
    const run = createRun(sevenDay, 1, 'directorate', { check: false });
    const w = run.kernel.world;
    w.alloc.power.s23 = 0;
    w.sectors[22].sumpLevel = 1;
    w.sectors[17].water.biocide = 0;
    w.alloc.medicine.s20 = 2;
    const c = view(run, 'family').cells;
    expect([c[23].served, c[22].flooded, c[17].unsafe, c[20].medicine]).toEqual([0, true, true, true]);
    expect([c[0].served, c[0].flooded, c[0].unsafe, c[0].medicine]).toEqual([1, false, false, false]);
  });
});

describe('audio clock', () => {
  it('shows every REAL TIME act leaving GREEN as it plays, while the world step alone would still read GREEN', () => {
    const run = createRun(sevenDay, 1, 'directorate', { check: false });
    const w = run.kernel.world;
    expect(audioClock(run, sevenDay.events, null, 0.2)).toBeNull(); // time-lapse: the world's own f
    for (const act of sevenDay.acts.filter((a) => a.mode === 'realtime')) {
      run.kernel.run(Math.ceil((act.atH * 3600) / 60) * 60 - w.t);
      const tiers: string[] = [];
      let c: AudioClock | null = null;
      for (let real = 0; real < 30; real += 0.2) { // the first 30 s, before the next world step can land
        run.tick(0.2);
        c = audioClock(run, sevenDay.events, c, 0.2);
        tiers.push(view(run, 'family', c).tier);
        expect(run.act()).toBe(act);
      }
      expect(tiers).toContain('RED');
      if (act.title.startsWith('The hum sags')) {
        expect(tiers.indexOf('AMBER')).toBeGreaterThan(0); // a sag, not a step: GREEN, then AMBER, then RED
        expect(w.grid.tier).toBe('GREEN');
      }
    }
  });
});
