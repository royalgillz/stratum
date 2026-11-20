import { describe, expect, it } from 'vitest';
import { rng } from '../rng.ts';
import { createFanWatch, type FanReading, type FanWatch } from './fan.ts';

// Synthetic level traces at 10 readings a second, as the phone sends them. Levels in dB.
const FAN = -80, QUIET = -110;
const wobble = (seed: number) => { const r = rng(seed, 'fan-test'); return () => (r() + r() + r() - 1.5) * 2; }; // about 1 dB
const add = (a: number, b: number) => 10 * Math.log10(10 ** (a / 10) + 10 ** (b / 10)); // two sounds add in power

/** Talk: bursts of 1 to 4 s, gaps of 2 to 6 s, each reading 3 to 15 dB over `over`. */
function talk(seed: number, over: number) {
  const r = rng(seed, 'talk');
  const on = new Set<number>();
  for (let t = 2; t < 600; ) {
    const len = 1 + 3 * r();
    for (let i = Math.round(t * 10); i < Math.round((t + len) * 10); i++) on.add(i);
    t += len + 2 + 4 * r();
  }
  return (t: number, base: number) => (on.has(Math.round(t * 10)) ? add(base, over + 3 + 12 * r()) : base);
}

function play(w: FanWatch, level: (t: number) => number, from: number, to: number): FanReading[] {
  const out: FanReading[] = [];
  for (let i = Math.round(from * 10); i < Math.round(to * 10); i++) {
    const r = w.push(i / 10, level(i / 10));
    if (r) out.push(r);
  }
  return out;
}
const first = (rs: FanReading[], s: FanReading['state']) => rs.find((r) => r.state === s)?.t;
const states = (rs: FanReading[]) => new Set(rs.map((r) => r.state));

/** A fan from t = 0 that stops at `stop` (or never). */
function fanThenQuiet(stop = Infinity, seed = 1) {
  const j = wobble(seed);
  return (t: number) => (t < stop ? FAN : QUIET) + j();
}

describe('air watch: fan stop', () => {
  // @spec AIR-FAN-001
  it('AIR-FAN-001 rejects an unknown label, starts LISTENING and gives the same readings for the same input', () => {
    expect(() => createFanWatch({ label: 'GUESS' as never })).toThrow(RangeError);
    const a = createFanWatch({ label: 'LIVE' }), b = createFanWatch({ label: 'LIVE' });
    const ra = play(a, fanThenQuiet(30), 0, 40), rb = play(b, fanThenQuiet(30), 0, 40);
    expect(ra[0].state).toBe('LISTENING');
    expect(ra).toEqual(rb);
  });

  // @spec AIR-FAN-002
  it('AIR-FAN-002 throws on a bad or backward time and skips a level that is not finite', () => {
    const w = createFanWatch({ label: 'LIVE' });
    play(w, fanThenQuiet(), 0, 15);
    expect(() => w.push(NaN, FAN)).toThrow(RangeError);
    expect(() => w.push(Infinity, FAN)).toThrow(RangeError);
    expect(() => w.push(10, FAN)).toThrow(RangeError);
    expect(w.push(15, -Infinity)).toBeNull();
    expect(w.push(15, NaN)).toBeNull();
    expect(w.push(14.95, FAN)!.state).toBe('RUNNING'); // the skipped levels did not move the last time (14.9)
    expect(w.push(14.95, FAN)!.state).toBe('RUNNING'); // the same time again is allowed
    // A muted microphone (digital silence) for 5 s is not a fan stop.
    const rs = play(w, (t) => (t < 20 ? -Infinity : FAN), 15.1, 30);
    expect(states(rs)).toEqual(new Set(['RUNNING']));
  });

  // @spec AIR-FAN-003
  it('AIR-FAN-003 takes the 20th percentile of the last 20 s as baseline and calls a narrow spread steady', () => {
    const w = createFanWatch({ label: 'LIVE' });
    let r!: FanReading;
    for (let i = 0; i < 10; i++) r = w.push(i, -10 * i)!; // levels 0 down to -90
    expect(r.baselineDb).toBe(-80); // sorted [-90 .. 0], index floor(0.2 x 9) = 1
    expect(r.steady).toBe(false); // median -50 is 30 dB over it
    const v = createFanWatch({ label: 'LIVE' });
    v.push(0, -90);
    v.push(10, -40);
    expect(v.push(20, -50)!.baselineDb).toBe(-50); // t = 0 is outside (0, 20]
    for (const [top, steady] of [[-76, true], [-75.9, false]] as const) {
      const s = createFanWatch({ label: 'LIVE' });
      for (let i = 0; i < 10; i++) r = s.push(i, i < 2 ? -80 : top)!; // index 1 is -80, the median (index 4) is top
      expect(r.steady, `median ${top}`).toBe(steady);
    }
    // Talk over a fan does not lift the baseline.
    const k = createFanWatch({ label: 'LIVE' }), j = wobble(3), say = talk(3, FAN);
    const rs = play(k, (t) => say(t, FAN + j()), 0, 120);
    for (const x of rs.filter((x) => x.t >= 20)) expect(Math.abs(x.baselineDb - FAN)).toBeLessThan(2);
    // 9 s of unbroken talk over a clean fan is under 80% of the 20 s window, so B stays at the fan.
    const u = play(createFanWatch({ label: 'LIVE' }), (t) => (t >= 20 && t < 29 ? FAN + 10 : FAN), 0, 35);
    expect(new Set(u.map((x) => x.baselineDb))).toEqual(new Set([FAN]));
  });

  // @spec AIR-FAN-004
  it('AIR-FAN-004 keeps the lowest baseline as the quiet floor, never above -100 dB', () => {
    const w = createFanWatch({ label: 'LIVE' });
    expect(w.push(0, -50)!.floorDb).toBe(-100);
    expect(w.push(1, -112)!.floorDb).toBe(-112);
    expect(play(w, () => -60, 2, 60).at(-1)!.floorDb).toBe(-112);
    // Any reading's B counts, steady or not: levels -30 down to -120 give B -110 with the median 40 dB over it.
    const n = createFanWatch({ label: 'LIVE' });
    let r!: FanReading;
    for (let i = 0; i < 10; i++) r = n.push(i, -30 - 10 * i)!;
    expect(r.steady).toBe(false);
    expect(r.floorDb).toBe(-110);
  });

  // @spec AIR-FAN-005
  it('AIR-FAN-005 hears a fan running after 10 s steady and 10 dB over the floor, and nothing in a quiet room', () => {
    // Fan already on when listening starts: the -100 dB cap stands in for the quiet.
    const rs = play(createFanWatch({ label: 'LIVE' }), fanThenQuiet(), 0, 30);
    expect(first(rs, 'RUNNING')).toBeCloseTo(10, 9);
    // A quieter fan, 15 dB over a quiet room heard first (only 5 dB over the cap).
    const j = wobble(5);
    const quiet = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? QUIET : -95) + j(), 0, 80);
    expect(first(quiet, 'RUNNING')).toBeGreaterThan(30);
    // Exactly 10 dB over a learned floor of -115 dB is a fan; 9.9 dB is not.
    for (const [over, runs] of [[10, true], [9.9, false]] as const) {
      const rs = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? -115 : -115 + over), 0, 80);
      expect(states(rs).has('RUNNING'), `${over} dB over`).toBe(runs);
    }
    // A quiet room with talk, for 5 minutes: never a fan, never an alert.
    const say = talk(6, QUIET), q = wobble(6);
    expect(states(play(createFanWatch({ label: 'LIVE' }), (t) => say(t, QUIET + q()), 0, 300))).toEqual(new Set(['LISTENING']));
    // Music: loud but not steady.
    const m = rng(7, 'music');
    expect(states(play(createFanWatch({ label: 'LIVE' }), () => -80 + 20 * m(), 0, 120))).toEqual(new Set(['LISTENING']));
  });

  // @spec AIR-FAN-006
  it('AIR-FAN-006 keeps the running level through a slow spin-down and holds it while stopped', () => {
    const j = wobble(8);
    // 1 dB/s from the fan level down to the quiet: the current baseline follows it, the running level does not.
    const rs = play(createFanWatch({ label: 'LIVE' }), (t) => Math.max(QUIET, t < 30 ? FAN : FAN - (t - 30)) + j(), 0, 200);
    const stop = first(rs, 'STOPPED')!;
    expect(stop).toBeGreaterThan(30);
    expect(stop).toBeLessThanOrEqual(45); // a 30 s spin-down is caught part way, not followed to the floor
    // Quiet for 2.5 minutes after the stop: the quiet never becomes the running level.
    const after = rs.filter((r) => r.t >= stop);
    expect(states(after)).toEqual(new Set(['STOPPED']));
    expect(after.at(-1)!.runningDb).toBeGreaterThan(FAN - 3);
    // While RUNNING, R is the highest B of a steady reading in (t - 10, t].
    for (const r of rs.filter((x) => x.state === 'RUNNING')) {
      const ref = rs.filter((x) => x.steady && x.t > r.t - 10 && x.t <= r.t).map((x) => x.baselineDb);
      if (ref.length) expect(r.runningDb, `t ${r.t}`).toBe(Math.max(...ref));
    }
    // Music over a running fan lifts B, but B is not steady then, so R stays at the fan and its end is no stop.
    const m = rng(12, 'music');
    const music = play(createFanWatch({ label: 'LIVE' }), (t) => (t >= 30 && t < 55 ? FAN + 5 + 20 * m() : FAN), 0, 80);
    expect(Math.max(...music.map((x) => x.baselineDb))).toBeGreaterThan(FAN + 6);
    expect(states(music)).toEqual(new Set(['LISTENING', 'RUNNING']));
    expect(music.at(-1)!.runningDb).toBe(FAN);
  });

  // @spec AIR-FAN-007
  it('AIR-FAN-007 alerts 2 s after a sudden stop, and not on a click, a door slam or a short dropout', () => {
    const rs = play(createFanWatch({ label: 'LIVE' }), fanThenQuiet(30), 0, 40);
    // 21 of the 30 readings in (29, 32] are low: exactly 70%, so the alert lands at 2.0 s.
    expect(first(rs, 'STOPPED')! - 30).toBeCloseTo(2, 9);
    const j = wobble(9);
    const knocks = (t: number) => {
      if (Math.abs(t - 40) < 0.05) return -50; // one loud click
      if (t >= 50 && t < 50.3) return -55; // a door slam
      if (t >= 60 && t < 61.5) return QUIET; // 1.5 s dropout
      return FAN + j();
    };
    expect(states(play(createFanWatch({ label: 'LIVE' }), knocks, 0, 100))).toEqual(new Set(['LISTENING', 'RUNNING']));
    // A clean fan turned down 5 dB is still running; one that falls 6 dB has stopped.
    for (const [step, alert] of [[5, false], [6, true]] as const) {
      const rs = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? FAN : FAN - step), 0, 60);
      expect(states(rs).has('STOPPED'), `${step} dB down`).toBe(alert);
    }
    // A 0.3 s dip inside unbroken loud talk over a running fan: talk readings say nothing, and 3 lows are too few.
    const dip = play(createFanWatch({ label: 'LIVE' }), (t) => (t >= 30 && t < 40 ? (t >= 35 && t < 35.3 ? QUIET : FAN + 10) : FAN), 0, 50);
    expect(states(dip)).not.toContain('STOPPED');
    // Talk going on after the fan stops: a 0.6 s pause is enough quiet to alert, a 0.5 s pause is not yet.
    for (const [pause, alert] of [[0.6, true], [0.5, false]] as const) {
      const rs = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? FAN : t >= 33 && t < 33 + pause ? QUIET : FAN + 10), 0, 36);
      expect(states(rs).has('STOPPED'), `${pause} s pause`).toBe(alert);
    }
    // After the stop, a sound on for 2 s of every 3: 4 dB over the fan it is set aside as talk and the stop
    // alerts in the first pause; exactly 3 dB over, it could still be the fan, so no alert.
    for (const [over, alert] of [[4, true], [3, false]] as const) {
      const rs = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? FAN : (t - 30) % 3 < 2 ? FAN + over : QUIET), 0, 45);
      const stop = first(rs, 'STOPPED');
      expect(stop !== undefined, `${over} dB over`).toBe(alert);
      if (alert) expect(stop! - 30).toBeLessThanOrEqual(3);
    }
    // A quiet room never alerts, however it changes, because no fan was heard running.
    expect(states(play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? -95 : -125), 0, 60))).not.toContain('STOPPED');
  });

  // @spec AIR-FAN-008
  it('AIR-FAN-008 returns to RUNNING 5 s after the fan comes back, catches the next stop, and talk does not clear the alert', () => {
    const j = wobble(10);
    const back = (t: number) => (t < 30 || (t >= 60 && t < 70) ? FAN : QUIET) + j();
    const rs = play(createFanWatch({ label: 'LIVE' }), back, 0, 80);
    const again = rs.find((r) => r.t > 60 && r.state === 'RUNNING')!.t;
    expect(again).toBeGreaterThanOrEqual(65 - 1e-9);
    expect(again).toBeLessThanOrEqual(65.1 + 1e-9);
    // The second stop, only 5 s after the return, is caught: the window restarted with the fan.
    expect(rs.find((r) => r.t > 70 && r.state === 'STOPPED')!.t).toBeLessThanOrEqual(72.1 + 1e-9);
    // A fan back 12 dB quieter is a new fan level, found by AIR-FAN-005, and is not stopped at once.
    const low = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? FAN : t < 60 ? QUIET : FAN - 12) + j(), 0, 140);
    const re = low.find((r) => r.t > 60 && r.state === 'RUNNING')!;
    expect(re.t).toBeLessThan(100);
    expect(states(low.filter((r) => r.t >= re.t))).toEqual(new Set(['RUNNING']));
    // Talk after a stop, in bursts up to 4 s, leaves the alert on.
    const say = talk(11, -75);
    const talked = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? FAN : t < 35 ? QUIET : say(t, QUIET)) + j(), 0, 180);
    expect(states(talked.filter((r) => r.t >= 32.1))).toEqual(new Set(['STOPPED']));
    // A level exactly R - 6 dB is still stopped: it never counts towards the 5 s return.
    // It comes back only as a new fan level (AIR-FAN-005), once B is steady there for 10 s.
    const edge = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? FAN : FAN - 6), 0, 60);
    const relevel = edge.find((r) => r.t > 32 && r.state === 'RUNNING')!;
    expect(relevel.t).toBeCloseTo(49.9, 9);
    expect(relevel.runningDb).toBe(FAN - 6);
    expect(states(edge.filter((r) => r.t >= 32 && r.t < relevel.t))).toEqual(new Set(['STOPPED']));
    // The fan back 4 dB quieter: RUNNING 5 s after it returns, and R moves to the new level once the
    // restarted window spans 10 s, from steady readings since the return only.
    const quieter = play(createFanWatch({ label: 'LIVE' }), (t) => (t < 30 ? FAN : t < 33 ? QUIET : FAN - 4), 0, 50);
    expect(first(quieter, 'RUNNING')).toBe(10);
    expect(quieter.find((r) => r.t > 33 && r.state === 'RUNNING')!.t).toBeCloseTo(38, 9);
    expect(quieter.find((r) => r.runningDb === FAN - 4)!.t).toBeCloseTo(43, 9);
    expect(quieter.filter((r) => r.t >= 43).every((r) => r.runningDb === FAN - 4)).toBe(true);
  });

  // @spec AIR-FAN-009
  it('AIR-FAN-009 carries time, state, levels and the label on each reading', () => {
    const w = createFanWatch({ label: 'SIMULATED' });
    const r0 = w.push(0, FAN)!;
    expect(r0).toEqual({ t: 0, state: 'LISTENING', levelDb: FAN, baselineDb: FAN, floorDb: -100, runningDb: null, steady: true, label: 'SIMULATED' });
    const rs = play(w, fanThenQuiet(), 0.1, 12);
    expect(Math.abs(rs.at(-1)!.runningDb! - FAN)).toBeLessThan(2);
    expect(rs.at(-1)!.label).toBe('SIMULATED');
  });

  // @spec AIR-FAN-010
  it('AIR-FAN-010 stays quiet through 5 minutes of fan and talk, then notices the stop within 5 s', () => {
    for (const seed of [21, 22, 23]) {
      const j = wobble(seed), say = talk(seed, FAN);
      const fan = (t: number) => say(t, FAN + j());
      const w = createFanWatch({ label: 'LIVE' });
      const rs = play(w, fan, 0, 300);
      expect(first(rs, 'RUNNING'), `seed ${seed}`).toBeLessThan(60);
      expect(states(rs), `seed ${seed}`).not.toContain('STOPPED');
      const stop = play(w, () => QUIET + j(), 300, 310);
      expect(first(stop, 'STOPPED')! - 300, `seed ${seed}`).toBeLessThanOrEqual(5);
      // The same fan and talk, but the talk goes on after the fan stops.
      const v = createFanWatch({ label: 'LIVE' });
      play(v, fan, 0, 300);
      const talking = play(v, (t) => say(t, QUIET + j()), 300, 310);
      expect(first(talking, 'STOPPED')! - 300, `seed ${seed} with talk`).toBeLessThanOrEqual(5);
    }
    // A spin-down over 10 s (3 dB a second), started at t = 30.
    const j = wobble(24);
    const rs = play(createFanWatch({ label: 'LIVE' }), (t) => Math.max(QUIET, t < 30 ? FAN : FAN - 3 * (t - 30)) + j(), 0, 40);
    expect(first(rs, 'STOPPED')! - 30).toBeLessThanOrEqual(5);
  }, 30_000); // 30 min of 10 Hz readings: slow when the machine is busy

  // @spec AIR-FAN-011
  it('AIR-FAN-011 catches a fan that stopped while the tab was frozen, and needs unbroken readings to call a fan running', () => {
    const j = wobble(13);
    const at = (times: number[], level: (t: number) => number) => {
      const w = createFanWatch({ label: 'LIVE' });
      return times.map((t) => w.push(t, level(t))!);
    };
    const tenHz = (a: number, b: number) => Array.from({ length: Math.round((b - a) * 10) }, (_, i) => a + i / 10);
    // No readings from 100 to 130 s; the fan stopped at 110. The first readings after the gap alert, and R stays at the fan.
    const frozen = at([...tenHz(0, 100), ...tenHz(130, 160)], (t) => (t < 110 ? FAN : QUIET) + j());
    const stop = first(frozen, 'STOPPED')!;
    expect(stop).toBeGreaterThanOrEqual(130);
    expect(stop).toBeLessThanOrEqual(132);
    expect(frozen.at(-1)!.runningDb).toBeGreaterThan(FAN - 3);
    // Readings once a minute (a throttled hidden tab) never make a run, so a fan is not claimed from them.
    expect(states(at(Array.from({ length: 10 }, (_, i) => 60 * i), () => FAN + j()))).toEqual(new Set(['LISTENING']));
    // Once a second (a hidden tab) is unbroken: RUNNING at 10 s, and a stop at 60 s is caught within 3 s.
    const slow = at(Array.from({ length: 100 }, (_, i) => i), (t) => (t < 60 ? FAN : QUIET) + j());
    expect(first(slow, 'RUNNING')).toBe(10);
    expect(first(slow, 'STOPPED')! - 60).toBeLessThanOrEqual(3);
    // Times off the 0.1 s grid, as the audio clock gives them: the reading that enters RUNNING already has R.
    const odd = at(Array.from({ length: 200 }, (_, i) => 0.18 + i / 10), () => FAN + j());
    expect(odd.find((r) => r.state === 'RUNNING')!.runningDb).not.toBeNull();
    expect(states(odd)).not.toContain('STOPPED');
  });
});
