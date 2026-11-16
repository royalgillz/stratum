import { describe, expect, it } from 'vitest';
import { createDetector } from './detector.ts';

// Constant baseline of 10: MAD 0, so scale is the 1% floor, 0.1; exceeding means |x - 10| >= 0.4.
function run(values: number[], d = createDetector()) {
  values.forEach((x, i) => d.push('cond', 'L1S1', i, x));
  return d;
}
const tens = (n: number) => Array<number>(n).fill(10);

describe('detector', () => {
  // @spec WIT-001
  it('opens no event while fewer than 24 readings are admitted, and admits every one of them', () => {
    const d = run([...tens(10), 50, 50, 50, ...tens(11)]); // 24 readings, three wild ones inside
    expect(d.events).toEqual([]);
    expect(d.baseline('cond', 'L1S1')?.n).toBe(24);
    expect(run([...tens(24), 50, 50, 50]).events).toHaveLength(1);
  });

  // @spec WIT-001
  it('floors the scale at 1% of the median and keeps streams apart', () => {
    expect(run([...tens(24), 10.3, 10.3, 10.3]).events).toEqual([]); // z = 3
    expect(run([...tens(24), 10.5, 10.5, 10.5]).events).toHaveLength(1); // z = 5
    const d = createDetector();
    tens(24).forEach((x, i) => d.push('cond', 'A', i, x));
    [50, 50, 50].forEach((x, i) => d.push('cond', 'B', 100 + i, x)); // B has no baseline yet
    expect(d.events).toEqual([]);
    expect(d.baseline('cond', 'A')?.median).toBe(10);
  });

  // @spec WIT-001
  it('takes the upper middle of an even count as the median', () => {
    const d = createDetector();
    [1, 2, 3, 4, ...Array<number>(20).fill(3)].forEach((x, i) => d.push('k', 'w', i, x));
    expect(d.baseline('k', 'w')?.median).toBe(3);
    const e = createDetector();
    [1, 2].forEach((x, i) => e.push('k', 'w', i, x));
    expect(e.baseline('k', 'w')?.median).toBe(2);
  });

  // @spec WIT-002
  it('marks a reading at 4 scale units exceeding and does not admit it', () => {
    const d = run([...tens(24), 10.4]); // z = 4
    expect(d.baseline('cond', 'L1S1')?.n).toBe(24);
    const e = run([...tens(24), 10.39]);
    expect(e.baseline('cond', 'L1S1')?.n).toBe(25);
  });

  // @spec WIT-003
  it('opens an event on the third exceeding reading of five, with tStart, tDetect, direction and peakZ', () => {
    const d = run([...tens(24), 11, 10, 12, 10, 11]); // indexes 24, 26, 28 exceed
    expect(d.events).toHaveLength(1);
    expect(d.events[0]).toMatchObject({ kind: 'cond', where: 'L1S1', tStart: 24, tDetect: 28, direction: 1 });
    expect(d.events[0]!.peakZ).toBeCloseTo(20, 6);
    expect(run([...tens(24), 11, 10, 10, 10, 11, 10, 10, 10, 11]).events).toEqual([]); // never 3 in 5
    expect(run([...tens(24), 11, 11, 10, 10, 10]).events).toEqual([]); // only 2
  });

  // @spec WIT-003
  it('takes tStart from the earliest exceeding reading among the last five, and a falling run has direction -1', () => {
    const d = run([...tens(24), 11, 10, 10, 9, 9]); // exceeding at 24, 27, 28
    expect(d.events[0]).toMatchObject({ tStart: 24, tDetect: 28, direction: -1 });
    const e = run([...tens(24), 11, 10, 10, 10, 10, 9, 9, 9]); // 24 has left the window
    expect(e.events[0]).toMatchObject({ tStart: 29, tDetect: 31, direction: -1 });
  });

  // @spec WIT-003
  it('raises peakZ with later exceeding readings while the event is open', () => {
    const d = run([...tens(24), 11, 11, 11, 15]);
    expect(d.events).toHaveLength(1);
    expect(d.events[0]!.peakZ).toBeCloseTo(50, 6);
  });

  // @spec WIT-004
  it('admits nothing while open, opens no second event, and closes after 5 clear readings', () => {
    const d = run([...tens(24), 11, 11, 11, 11, 10, 10, 10, 10]); // 4 clear
    expect(d.events).toHaveLength(1);
    expect(d.events[0]!.tEnd).toBeUndefined();
    expect(d.baseline('cond', 'L1S1')?.n).toBe(24);
    d.push('cond', 'L1S1', 32, 11); // exceeding resets the count of clear readings
    [10, 10, 10, 10].forEach((x, i) => d.push('cond', 'L1S1', 33 + i, x));
    expect(d.events[0]!.tEnd).toBeUndefined();
    d.push('cond', 'L1S1', 37, 10); // fifth clear
    expect(d.events[0]!.tEnd).toBe(37);
    expect(d.baseline('cond', 'L1S1')?.n).toBe(24); // the fifth is not admitted
    d.push('cond', 'L1S1', 38, 10);
    expect(d.baseline('cond', 'L1S1')?.n).toBe(25);
    expect(d.events).toHaveLength(1);
  });

  // @spec WIT-004
  it('starts from an empty last-five window after closing, so a new event needs three new exceedances', () => {
    const d = run([...tens(24), 11, 11, 11, ...tens(5), 11, 11]);
    expect(d.events).toHaveLength(1);
    d.push('cond', 'L1S1', 99, 11);
    expect(d.events).toHaveLength(2);
    expect(d.events[1]).toMatchObject({ tStart: 32, tDetect: 99 });
  });
});
