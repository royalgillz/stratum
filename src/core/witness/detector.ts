export interface DetectorEvent {
  kind: string;
  where: string;
  tStart: number;
  tDetect: number;
  tEnd?: number;
  direction: 1 | -1;
  peakZ: number;
}

const WINDOW = 48; // admitted readings kept as the baseline
const MIN_BASELINE = 24;
const THRESHOLD = 4; // scale units
const NEEDED = 3; // exceeding readings ...
const OF = 5; // ... among the last five
const CLEAR = 5; // consecutive clear readings that close an event

/** First index in rising `v` whose value is not below `x`. */
const lowerBound = (v: number[], x: number) => {
  let lo = 0, hi = v.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (v[m]! < x) lo = m + 1;
    else hi = m;
  }
  return lo;
};

/** The upper-middle absolute deviation of rising `v` from its upper-middle value `v[mid]`. */
function madOf(v: number[], mid: number): number {
  // Deviations below the median (L) and from it upward (R) each rise: binary-search how many of the
  // mid + 1 smallest come from L; the largest of those taken is the mid-th smallest.
  const n = v.length, med = v[mid]!;
  const L = (a: number) => Math.abs(v[mid - 1 - a]! - med), R = (b: number) => Math.abs(v[mid + b]! - med);
  let lo = Math.max(0, 2 * mid + 1 - n), hi = mid;
  for (;;) {
    const a = (lo + hi) >> 1, b = mid + 1 - a;
    if (a < mid && b > 0 && R(b - 1) > L(a)) lo = a + 1;
    else if (a > 0 && b < n - mid && L(a - 1) > R(b)) hi = a - 1;
    else return Math.max(a > 0 ? L(a - 1) : -Infinity, b > 0 ? R(b - 1) : -Infinity);
  }
}

interface Stream {
  admitted: number[];
  sorted: number[]; // `admitted` in rising order, kept in step so the median needs no sort; assumes finite readings, and -0 and 0 tie, so the median's sign of zero may follow either
  recent: { t: number; z: number; ex: boolean }[];
  open?: DetectorEvent;
  clear: number;
}

/** One rolling-baseline change detector per (kind, where) stream. */
// @spec WIT-001
export function createDetector() {
  const streams = new Map<string, Map<string, Stream>>(); // kind -> where -> stream
  const events: DetectorEvent[] = [];
  const get = (kind: string, where: string) => {
    let byWhere = streams.get(kind);
    if (!byWhere) streams.set(kind, (byWhere = new Map()));
    let s = byWhere.get(where);
    if (!s) byWhere.set(where, (s = { admitted: [], sorted: [], recent: [], clear: 0 }));
    return s;
  };
  // Median and MAD are the upper middle values of an even count.
  const stats = (s: Stream) => {
    const mid = s.sorted.length >> 1, med = s.sorted[mid]!;
    return { median: med, scale: Math.max(1.4826 * madOf(s.sorted, mid), 0.01 * Math.abs(med), 1e-9) };
  };
  const admit = (s: Stream, x: number) => {
    s.admitted.push(x);
    s.sorted.splice(lowerBound(s.sorted, x), 0, x);
    if (s.admitted.length > WINDOW) s.sorted.splice(lowerBound(s.sorted, s.admitted.shift()!), 1);
  };

  return {
    events,
    baseline(kind: string, where: string) {
      const s = streams.get(kind)?.get(where);
      return s && s.admitted.length ? { ...stats(s), n: s.admitted.length } : null;
    },
    // @spec WIT-002, WIT-003, WIT-004
    push(kind: string, where: string, t: number, x: number): void {
      const s = get(kind, where);
      if (s.admitted.length < MIN_BASELINE) return admit(s, x);
      const { median: med, scale } = stats(s);
      const z = (x - med) / scale;
      const ex = Math.abs(z) >= THRESHOLD;
      s.recent.push({ t, z, ex });
      if (s.recent.length > OF) s.recent.shift();
      if (s.open) {
        if (ex) { s.clear = 0; s.open.peakZ = Math.max(s.open.peakZ, Math.abs(z)); return; }
        if (++s.clear === CLEAR) { s.open.tEnd = t; s.open = undefined; s.clear = 0; s.recent = []; }
        return;
      }
      if (!ex) return admit(s, x);
      const hits = s.recent.filter((r) => r.ex);
      if (hits.length >= NEEDED) {
        s.open = { kind, where, tStart: hits[0]!.t, tDetect: t, direction: z > 0 ? 1 : -1, peakZ: Math.max(...hits.map((r) => Math.abs(r.z))) };
        s.clear = 0;
        events.push(s.open);
      }
    },
  };
}
