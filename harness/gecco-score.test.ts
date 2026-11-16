import { describe, expect, it } from 'vitest';
import { alarms, GRACE_MIN, MERGE_MIN, score, spans } from './gecco-score.ts';

describe('GECCO scoring', () => {
  it('turns runs of TRUE labels into inclusive spans, including one at either edge', () => {
    expect(spans([true, false, false, true, true, false, true])).toEqual([{ start: 0, end: 0 }, { start: 3, end: 4 }, { start: 6, end: 6 }]);
    expect(spans([])).toEqual([]);
  });

  it('merges openings within MERGE_MIN of the last alarm, measured from the alarm so a chain of openings cannot merge forever', () => {
    // 12 and 40 are within 30 of the alarm at 10; 41 is 31 after it, so a new alarm; 71 is exactly 30 after 41, merged.
    expect(alarms([40, 12, 10, 41, 71, 72])).toEqual([10, 41, 72]);
    expect(MERGE_MIN).toBe(30);
    expect(alarms([])).toEqual([]);
  });

  it('catches an event by an opening inside it or within the grace after its start, and counts the rest as false alarms', () => {
    const events = [{ start: 100, end: 110 }, { start: 200, end: 300 }, { start: 400, end: 405 }];
    // Alarms after merging: 99 (false, before event 1), 250 (inside event 2), 400 + GRACE + 1 (late, false). 105 and 107 merge into 99.
    const r = score(events, [99, 105, 107, 250, 400 + GRACE_MIN + 1], 0, 10080);
    // Event 1 is still caught at delay 5 by the raw opening at 105; event 2 at delay 50.
    expect(r).toEqual({ events: 3, caught: 2, recall: 2 / 3, alarms: 3, falseAlarms: 2, precision: 1 / 3, falseAlarmsPerWeek: 2, medianDelayMin: 27.5 });
    expect(score([{ start: 400, end: 405 }], [400 + GRACE_MIN], 0, 1000).caught).toBe(1); // the grace edge is inclusive
  });

  it('does not let a false alarm just before an event swallow the opening inside it', () => {
    // The held-out Leit openings at start + 2 that a Cl or Cl_2 alarm minutes earlier had absorbed.
    expect(score([{ start: 100, end: 122 }], [95, 102], 0, 1000)).toMatchObject({ caught: 1, medianDelayMin: 2, alarms: 1, falseAlarms: 1 });
  });

  it('scores only events starting and alarms falling in [from, to), with null ratios when there is nothing to divide by', () => {
    const r = score([{ start: 5, end: 8 }, { start: 50, end: 60 }], [6, 90], 10, 10 + 10080 / 2);
    expect(r).toEqual({ events: 1, caught: 0, recall: 0, alarms: 1, falseAlarms: 1, precision: 0, falseAlarmsPerWeek: 2, medianDelayMin: null });
    expect(score([], [], 0, 10)).toMatchObject({ recall: null, precision: null, falseAlarmsPerWeek: 0 });
  });
});
