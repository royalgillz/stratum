import { describe, expect, it } from 'vitest';
import type { Script } from './types.ts';
import { validateScript } from './validate.ts';

const good = (): Script => ({
  name: 'test',
  days: 2,
  demo: { id: 'family', level: 5, sector: 1, members: 4 },
  acts: [
    { atH: 0, mode: 'timelapse', title: 'a' },
    { atH: 1, mode: 'realtime', scale: 1, title: 'b' },
    { atH: 1.5, mode: 'timelapse', scale: 600, title: 'c' },
  ],
  events: [
    { type: 'shortfall', atH: 1, from: 0.04, to: 0.08, rampH: 4, holdH: 6, recoverH: 2 },
    { type: 'trip', atH: 2, loss: 0.058, durH: 3 },
    { type: 'contamination', atH: 3, level: 5, rampH: 0.5, durH: 12, delta: { cond: 60, toc: 5, turb: 1.5, biocide: -1.5 } },
    { type: 'flood', atH: 4, sector: 22, inflowM3h: 15, durH: 10 },
    { type: 'outbreak', atH: 5, sector: 20, cases: 10 },
    { type: 'separate', atH: 6, away: 0.3 },
    { type: 'network-down', atH: 0, durH: 48 },
  ],
});

/** Applies `edit` to a fresh good script and expects a RangeError whose message names `field`. */
function bad(field: string, edit: (s: any) => void) {
  const s = good();
  edit(s);
  expect(() => validateScript(s), field).toThrow(RangeError);
  expect(() => validateScript(s), field).toThrow(field);
}

describe('validateScript', () => {
  // @spec SCEN-001
  it('SCEN-001 accepts a good script, including times at 0 and at days x 24', () => {
    expect(() => validateScript(good())).not.toThrow();
    const s = good();
    s.events[0].atH = 48;
    s.acts.push({ atH: 48, mode: 'timelapse', title: 'end' });
    expect(() => validateScript(s)).not.toThrow();
  });

  // @spec SCEN-001
  it('SCEN-001 rejects days that are not a positive integer', () => {
    bad('days', (s) => (s.days = 0));
    bad('days', (s) => (s.days = 1.5));
    bad('days', (s) => (s.days = NaN));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects an unknown event type and a missing event field', () => {
    bad('events[1].type', (s) => (s.events[1].type = 'meteor'));
    bad('events[0].recoverH', (s) => delete s.events[0].recoverH);
    bad('events[2].delta', (s) => delete s.events[2].delta);
    bad('events[2].delta.biocide', (s) => delete s.events[2].delta.biocide);
    bad('events[4].cases', (s) => (s.events[4].cases = '10'));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects event and act times outside [0, days x 24]', () => {
    bad('events[1].atH', (s) => (s.events[1].atH = -0.1));
    bad('events[1].atH', (s) => (s.events[1].atH = 48.01));
    bad('acts[2].atH', (s) => (s.acts[2].atH = 49));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects levels outside 1 to 6 and event sectors outside 0 to 23', () => {
    bad('events[2].level', (s) => (s.events[2].level = 0));
    bad('events[2].level', (s) => (s.events[2].level = 7));
    bad('events[3].sector', (s) => (s.events[3].sector = 24));
    bad('events[4].sector', (s) => (s.events[4].sector = -1));
    bad('events[4].sector', (s) => (s.events[4].sector = 2.5));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects fractions outside [0, 1] and negative durations', () => {
    bad('events[0].from', (s) => (s.events[0].from = -0.01));
    bad('events[0].to', (s) => (s.events[0].to = 1.01));
    bad('events[1].loss', (s) => (s.events[1].loss = 2));
    bad('events[5].away', (s) => (s.events[5].away = 1.5));
    bad('events[0].rampH', (s) => (s.events[0].rampH = -1));
    bad('events[0].holdH', (s) => (s.events[0].holdH = -1));
    bad('events[1].durH', (s) => (s.events[1].durH = -1));
    bad('events[3].durH', (s) => (s.events[3].durH = -1));
    bad('events[6].durH', (s) => (s.events[6].durH = -1));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects a contamination ramp longer than its duration', () => {
    bad('events[2].rampH', (s) => (s.events[2].rampH = 13));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects a second separate event', () => {
    bad('events[7].type', (s) => s.events.push({ type: 'separate', atH: 7, away: 0.1 }));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects non-finite numbers', () => {
    bad('events[3].inflowM3h', (s) => (s.events[3].inflowM3h = Infinity));
    bad('events[2].delta.toc', (s) => (s.events[2].delta.toc = NaN));
    bad('events[0].holdH', (s) => (s.events[0].holdH = Infinity));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects acts out of order, not starting at 0, or with a bad scale', () => {
    bad('acts[0].atH', (s) => (s.acts[0].atH = 0.5));
    bad('acts[0].atH', (s) => (s.acts = []));
    bad('acts[2].atH', (s) => (s.acts[2].atH = 0.5));
    bad('acts[2].atH', (s) => (s.acts[2].atH = 1));
    bad('acts[1].scale', (s) => (s.acts[1].scale = 2));
    bad('acts[2].scale', (s) => (s.acts[2].scale = 0));
    bad('acts[2].scale', (s) => (s.acts[2].scale = Infinity));
    bad('acts[2].mode', (s) => (s.acts[2].mode = 'pause'));
  });

  // @spec SCEN-001
  it('SCEN-001 rejects a bad demo household', () => {
    bad('demo.id', (s) => (s.demo.id = ''));
    bad('demo.id', (s) => (s.demo.id = 'h5-0'));
    bad('demo.id', (s) => (s.demo.id = 'h23-9'));
    bad('demo.level', (s) => (s.demo.level = 7));
    bad('demo.sector', (s) => (s.demo.sector = 4));
    bad('demo.members', (s) => (s.demo.members = 0));
    bad('demo.members', (s) => (s.demo.members = 2.5));
    // ids outside the generated range are free
    const s = good();
    s.demo.id = 'h24-0';
    expect(() => validateScript(s)).not.toThrow();
  });
});
