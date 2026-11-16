// ENF-WHU evidence: replays every real recording through the phone's hum tracker in its 50 Hz setting and scores it against
// the dataset's reference ENF (docs/plan.md, Evidence: "Tracker on ENF-WHU clips"). Fetch the data first: see data/README.md.
// Usage: npm run score:enf -- [--data data/enf-whu] [--h 2] [--out public/evidence/enf-whu.json]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { createTracker, type Reading } from '../src/core/tracker/tracker.ts';
import { errorsMHz, parseWav, percentile, round1 } from './enf-score.ts';

const USAGE = 'usage: npm run score:enf -- [--data <dir>] [--h <1|2|3>] [--out <path>]';
let args: { data: string; h: string; out: string };
try {
  args = parseArgs<typeof args>({ options: { data: { type: 'string', default: 'data/enf-whu' }, h: { type: 'string', default: '2' }, out: { type: 'string', default: 'public/evidence/enf-whu.json' } } }).values;
} catch (e) {
  console.error(`${(e as Error).message}\n${USAGE}`);
  process.exit(2);
}
const h = Number(args.h);
if (![1, 2, 3].includes(h)) {
  console.error(`bad --h ${args.h}\n${USAGE}`);
  process.exit(2);
}
const dir = `${args.data}/ENF-WHU-Dataset`;
if (!existsSync(`${dir}/H1`)) {
  console.error(`no ENF-WHU recordings in ${dir}: fetch them as data/README.md says, or pass --data`);
  process.exit(2);
}

// The 50 Hz setting from docs/intent/tracker/tracker-design.md: w 1.5 Hz at h 2, widened at h 1 to keep the ±3 Hz tone band floor.
const F0 = 50, W = Math.max(1.5, 3 / h);
const WIN_S = 2; // the tracker's window, so each reading is compared with the reference over the same 2 s
const wavs = (sub: string) => readdirSync(`${dir}/${sub}`).filter((f) => f.endsWith('.wav')).sort();

let audioS = 0, computeMs = 0;
function track(path: string): { seconds: number; readings: Reading[] } {
  const { sampleRate, x } = parseWav(readFileSync(path));
  const t0 = performance.now();
  const readings = createTracker({ sampleRate, f0: F0, h, w: W, label: 'REPLAY' }).push(x);
  computeMs += performance.now() - t0;
  audioS += x.length / sampleRate;
  return { seconds: Math.round(x.length / sampleRate), readings };
}
const share = (part: number, whole: number) => Math.round((part / whole) * 1000) / 1000;
const noHumOf = (rs: Reading[]) => rs.filter((r) => r.state === 'NO_HUM').length;

// H1: recordings with grid hum; H1_ref/<id>_ref.wav is the mains waveform recorded alongside, same start, 400 Hz sampling.
// Recordings run up to 1 s past their reference; a shift scan of the reference by -1 to +1 s on clips 117 and 122 put the lowest error at 0 or -0.5 s, and 10 s raised it 4 to 7x.
const all: number[] = [];
let readings = 0, noHum = 0;
const withHum = wavs('H1').map((f) => {
  const id = f.slice(0, -4);
  const clip = track(`${dir}/H1/${f}`);
  const ref = parseWav(readFileSync(`${dir}/H1_ref/${id}_ref.wav`));
  const e = errorsMHz(clip.readings, ref.x, ref.sampleRate, WIN_S, F0);
  const n = noHumOf(clip.readings);
  all.push(...e);
  readings += clip.readings.length;
  noHum += n;
  const row = { id, seconds: clip.seconds, readings: clip.readings.length, noHumShare: share(n, clip.readings.length), scored: e.length, medianMHz: round1(percentile(e, 0.5)), p95MHz: round1(percentile(e, 0.95)) };
  console.log(`  H1 ${id}: no hum ${(row.noHumShare * 100).toFixed(1)}%, scored ${row.scored}, median ${row.medianMHz} mHz, p95 ${row.p95MHz} mHz`);
  return row;
});

// H0: recordings with no grid signal. O01..O10 are the whole recordings; 01..40 are random crops of them, so scored apart.
const noGrid = wavs('H0').map((f) => {
  const clip = track(`${dir}/H0/${f}`);
  return { id: f.slice(0, -4), seconds: clip.seconds, readings: clip.readings.length, noHum: noHumOf(clip.readings) };
});
const group = (rows: typeof noGrid) => {
  const r = rows.reduce((s, c) => s + c.readings, 0);
  return { clips: rows.length, readings: r, noHumShare: share(rows.reduce((s, c) => s + c.noHum, 0), r) };
};

const clipMedians = withHum.flatMap((c) => (c.medianMHz === null ? [] : [c.medianMHz]));

const evidence = {
  dataset: 'ENF-WHU',
  source: 'https://github.com/ghua-ac/ENF-WHU-Dataset',
  generatedBy: 'harness/enf.ts',
  label: 'REPLAY',
  tracker: { f0: F0, h, w: W, windowS: WIN_S },
  withHum: {
    clips: withHum.length,
    readings,
    noHumShare: share(noHum, readings),
    scored: all.length,
    medianMHz: round1(percentile(all, 0.5)),
    p95MHz: round1(percentile(all, 0.95)),
    // The pooled median above is weighted to clean clips (they pass the SNR gate more often), so quote it with these.
    clipMedians: {
      clips: clipMedians.length,
      medianMHz: round1(percentile(clipMedians, 0.5)),
      atOrUnder10: clipMedians.filter((m) => m <= 10).length,
      atOrUnder20: clipMedians.filter((m) => m <= 20).length,
      atOrUnder50: clipMedians.filter((m) => m <= 50).length,
      over500: clipMedians.filter((m) => m > 500).length,
    },
    perClip: withHum,
  },
  noGrid: {
    whole: group(noGrid.filter((c) => c.id.startsWith('O'))),
    crops: group(noGrid.filter((c) => !c.id.startsWith('O'))),
    perClip: noGrid.map(({ noHum, ...c }) => ({ ...c, noHumShare: share(noHum, c.readings) })),
  },
};
console.log(JSON.stringify({ ...evidence, withHum: { ...evidence.withHum, perClip: undefined }, noGrid: { ...evidence.noGrid, perClip: undefined } }, null, 1));
// Runtime goes to the console only, so the evidence file stays byte-identical across reruns.
console.log(`runtime: ${(computeMs / 1000).toFixed(1)} s of tracker time for ${(audioS / 3600).toFixed(2)} h of audio (${(audioS / (computeMs / 1000)).toFixed(0)}x real time)`);
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(evidence) + '\n');
console.log(`wrote ${args.out}`);
