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

/** Upper middle value of an even count. */
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

interface Stream {
  admitted: number[];
  recent: { t: number; z: number; ex: boolean }[];
  open?: DetectorEvent;
  clear: number;
}

/** One rolling-baseline change detector per (kind, where) stream. */
// @spec WIT-001
export function createDetector() {
  const streams = new Map<string, Stream>();
  const events: DetectorEvent[] = [];
  const get = (kind: string, where: string) => {
    const k = `${kind}\0${where}`;
    if (!streams.has(k)) streams.set(k, { admitted: [], recent: [], clear: 0 });
    return streams.get(k)!;
  };
  const stats = (s: Stream) => {
    const med = median(s.admitted);
    const mad = median(s.admitted.map((x) => Math.abs(x - med)));
    return { median: med, scale: Math.max(1.4826 * mad, 0.01 * Math.abs(med), 1e-9) };
  };
  const admit = (s: Stream, x: number) => { s.admitted.push(x); if (s.admitted.length > WINDOW) s.admitted.shift(); };

  return {
    events,
    baseline(kind: string, where: string) {
      const s = streams.get(`${kind}\0${where}`);
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
