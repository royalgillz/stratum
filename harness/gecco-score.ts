// Pure event-level scoring of detector alarms against the GECCO 2018 EVENT labels (plan: "Evidence", "Detector on GECCO water data").
// Times are minutes; the series is one row per minute, so row i is minute i.

/** A labelled event: a run of EVENT = TRUE rows, both ends inclusive. */
export interface Span { start: number; end: number }

/** An alarm still counts for an event this many minutes after the event's start, even past a shorter labelled run. */
export const GRACE_MIN = 30;
const WEEK_MIN = 7 * 24 * 60;

export function spans(labels: boolean[]): Span[] {
  const out: Span[] = [];
  labels.forEach((on, i) => {
    if (!on) return;
    const last = out[out.length - 1];
    if (last && last.end === i - 1) last.end = i;
    else out.push({ start: i, end: i });
  });
  return out;
}

/** Openings within this many minutes of the last alarm are the same alarm, so one upset seen on three sensors is one alarm. */
export const MERGE_MIN = 30;

/** Alarm times from detector event openings (tDetect). Not "any stream open": a stream whose level shifts stays open for weeks and would silence the rest. */
export function alarms(tDetect: number[]): number[] {
  const out: number[] = [];
  for (const t of [...tDetect].sort((a, b) => a - b)) if (!out.length || t - out[out.length - 1]! > MERGE_MIN) out.push(t);
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) : null;
};

/** Scores the events that start, and the openings that fall, in minutes [from, to). null where a ratio has no denominator.
 * Catching uses the raw openings: merging would let a false alarm just before an event swallow the opening inside it. Alarms and false alarms are counted after merging. */
export function score(events: Span[], tDetect: number[], from: number, to: number) {
  const ev = events.filter((e) => e.start >= from && e.start < to);
  const inRange = (t: number) => t >= from && t < to;
  const openings = [...tDetect].sort((a, b) => a - b).filter(inRange);
  const al = alarms(tDetect).filter(inRange);
  const inWindow = (t: number, e: Span) => t >= e.start && t <= Math.max(e.end, e.start + GRACE_MIN);
  const delays = ev.flatMap((e) => {
    const first = openings.find((t) => inWindow(t, e));
    return first === undefined ? [] : [first - e.start];
  });
  const falseAlarms = al.filter((t) => !ev.some((e) => inWindow(t, e))).length;
  return {
    events: ev.length,
    caught: delays.length,
    recall: ev.length ? delays.length / ev.length : null,
    alarms: al.length,
    falseAlarms,
    precision: al.length ? (al.length - falseAlarms) / al.length : null,
    falseAlarmsPerWeek: (falseAlarms * WEEK_MIN) / (to - from),
    medianDelayMin: median(delays),
  };
}
