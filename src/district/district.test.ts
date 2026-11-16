// The district page's pure steps: the gateway's packet-to-message rule and the worker's snapshot of a run.
import { describe, expect, it } from 'vitest';
import { createDecoder, encode, TYPES } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { createRun } from '../core/scenario/run.ts';
import { sevenDay } from '../core/scenario/seven-day.ts';
import { toMessage } from './gateway.ts';
import { badges, noEvent, PROBLEMS, show, winner } from './problems.ts';
import { stressWeek } from '../core/scenario/stress-week.ts';
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
  it('reports 24 sectors, all fifteen metrics, and a LIVE OK on the demo board after the next step', () => {
    const run = createRun(sevenDay, 1, 'stratum', { check: false });
    run.kernel.run(3 * 3600);
    const v = view(run, sevenDay.demo.id);
    expect(v.t).toBe(3 * 3600);
    expect(v.cells).toHaveLength(24);
    expect(v.cells.every((c) => c.served === 1 && !c.flooded && !c.unsafe)).toBe(true); // nothing has gone wrong by hour 3
    expect(Object.keys(v.metrics)).toEqual(Array.from({ length: 15 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`));
    expect(Object.values(v.metrics).every((m) => m.label === 'SIMULATED')).toBe(true);
    expect(v.cells.every((c) => c.food === 3)).toBe(true); // every store full: 3 days of the standard ration
    expect(v.surface).toBe('unknown'); // no surface reading before the campaign
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
  it('shows the sag and trip acts leaving GREEN as they play, while the world step alone would still read GREEN', () => {
    const run = createRun(sevenDay, 1, 'directorate', { check: false });
    const w = run.kernel.world;
    expect(audioClock(run, null, 0.2)).toBeNull(); // time-lapse: the world's own f
    // The Level 5 act comes after the deep shortfall's first shed: shedding keeps load under capacity, so its hum stays steady.
    for (const act of run.script.acts.filter((a) => a.mode === 'realtime' && !a.title.startsWith('Level 5'))) {
      run.kernel.run(Math.ceil((act.atH * 3600) / 60) * 60 - w.t);
      const tiers: string[] = [];
      let c: AudioClock | null = null;
      for (let real = 0; real < 30; real += 0.2) { // the first 30 s, before the next world step can land
        run.tick(0.2);
        c = audioClock(run, c, 0.2);
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

  it('shows the demo sector going dark inside the Level 5 act under the Directorate and lit under STRATUM', () => {
    for (const policy of ['directorate', 'stratum'] as const) {
      const run = createRun(sevenDay, 1, policy, { check: false });
      const act = run.script.acts.find((a) => a.title === 'Level 5 goes dark: deepest first')!;
      run.kernel.run(act.atH * 3600 - run.kernel.world.t);
      const served: number[] = [], tiers: string[] = [];
      while (run.act() === act) {
        run.tick(1);
        const v = view(run, 'family', audioClock(run, null, 1));
        served.push(v.cells[17]!.served);
        tiers.push(v.tier);
      }
      expect(new Set(tiers)).toEqual(new Set(['GREEN'])); // after the first shed the hum stays GREEN under both policies
      if (policy === 'directorate') expect([served[0], served.at(-1)]).toEqual([1, 0]);
      else expect(Math.min(...served)).toBeGreaterThan(0.3); // above the life floor
    }
  }, 30_000); // two runs to hour 75: over the 5 s default under a loaded suite
});

describe('problems: shown values and who did better', () => {
  it('prints shares as percentages, nothing proven in words, and reads each metric by its direction', () => {
    expect(show(0.25, 'share')).toBe('25%');
    expect(show(22941.7, 'person-h')).toBe('22,900 person\u2011h');
    expect(show(100000, 'APF')).toBe('none proven');
    expect(show(10000, 'APF')).toBe('APF 10,000');
    expect(winner('higher', 0, 0.25)).toBe('STRATUM');
    expect(winner('lower', 0, 500)).toBe('Directorate');
    expect(winner('lower', 3, 3)).toBe('tie');
    expect(PROBLEMS.map((p) => p.id)).toEqual(Array.from({ length: 15 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`));
    expect(PROBLEMS.every((p) => badges(p.tier).length > 0)).toBe(true);
  });

  it('names the missing event instead of a placeholder zero', () => {
    expect(noEvent('p08', sevenDay.events, 0)).toBe('no separations yet');
    expect(noEvent('p08', sevenDay.events, 2 * 3600)).toBeNull();
    expect(noEvent('p08', stressWeek.events, 7 * 86400)).toBe('no separations in this script');
    expect(noEvent('p13', sevenDay.events, 119 * 3600)).toBe('no surface readings yet');
    expect(noEvent('p15', sevenDay.events, 0)).toBe('no plan yet');
    expect(noEvent('p15', sevenDay.events, 60)).toBeNull();
    expect(noEvent('p03', stressWeek.events, 0)).toBeNull();
  });
});
