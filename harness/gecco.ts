// GECCO 2018 harness: replays the real drinking-water series through the Witness change detector (the detector that Witness.observe
// feeds every measured reading to, unchanged) and scores its alarms against the EVENT labels. The detector runs with its spec settings (docs/params.md).
// Usage: npm run score:gecco   Writes public/evidence/gecco.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDetector } from '../src/core/witness/detector.ts';
import { GRACE_MIN, MERGE_MIN, score, spans } from './gecco-score.ts';

const CSV = 'data/gecco2018/1_gecco2018_water_quality.csv';
const OUT = 'public/evidence/gecco.json';
const HEADER = ['', 'Time', 'Tp', 'Cl', 'pH', 'Redox', 'Leit', 'Trueb', 'Cl_2', 'Fm', 'Fm_2', 'EVENT'];
const SENSORS = HEADER.slice(2, 11);
// The challenge rules call temperature and the two flow rates operational data whose changes are not events, so the headline set leaves them out.
const QUALITY = ['Cl', 'pH', 'Redox', 'Leit', 'Trueb', 'Cl_2'];
const PICK_PRECISION = 0.5; // "picked" keeps the quality sensors whose own first-half alarms were at least half right

const [head, ...lines] = readFileSync(CSV, 'utf8').trimEnd().split(/\r?\n/);
if (head!.replaceAll('"', '') !== HEADER.join(',')) throw new Error(`${CSV}: unexpected header ${head}`);
const rows = lines.map((l) => l.split(','));

// Rows are one minute apart throughout (the one backward clock step is the October DST change, still 60 s of real time), so row i is minute i.
// The detector directly, not createWitness: observe would also hash 1.2 million ledger entries (20 times slower) for the same events.
const detector = createDetector();
const labels = rows.map((r, i) => {
  SENSORS.forEach((kind, c) => {
    const cell = r[c + 2]!;
    if (cell === 'NA') return; // a missing reading is not a reading
    const x = Number(cell);
    if (!Number.isFinite(x)) throw new Error(`${CSV} row ${i + 1}: bad ${kind} ${cell}`);
    detector.push(kind, 'gecco', i, x);
  });
  if (r[11] !== 'TRUE' && r[11] !== 'FALSE') throw new Error(`${CSV} row ${i + 1}: bad EVENT ${r[11]}`);
  return r[11] === 'TRUE';
});

const events = spans(labels);
// Detector settings are never tuned. Only the sensor set of "picked" is chosen, from first-half scores alone; report the held-out second half.
const half = rows.length >> 1;
const run = (kinds: string[]) => {
  const a = detector.events.filter((e) => kinds.includes(e.kind)).map((e) => e.tDetect);
  return { kinds, firstHalf: score(events, a, 0, half), heldOut: score(events, a, half, rows.length) };
};
const results: Record<string, ReturnType<typeof run>> = { quality: run(QUALITY), all: run(SENSORS) };
for (const k of SENSORS) results[k] = run([k]);
results.picked = run(QUALITY.filter((k) => (results[k]!.firstHalf.precision ?? 0) >= PICK_PRECISION));

const evidence = {
  dataset: 'GECCO Industrial Challenge 2018 water quality (Thueringer Fernwasserversorgung, via TH Koeln)',
  source: 'https://zenodo.org/records/3884398',
  licence: 'CC BY 4.0',
  attribution: "Moritz, S., Rehbach, F., Chandrasekaran, S., Rebolledo, M. and Bartz-Beielstein, T. (2018). GECCO Industrial Challenge 2018 Dataset: A water quality dataset for the 'Internet of Things: Online Anomaly Detection for Drinking Water Quality' competition at the Genetic and Evolutionary Computation Conference 2018, Kyoto, Japan. Zenodo. DOI 10.5281/zenodo.3884398",
  generatedBy: 'harness/gecco.ts',
  label: 'REPLAY',
  rows: rows.length,
  minutesPerRow: 1,
  split: { firstHalf: [0, half], heldOut: [half, rows.length], detectorTuned: false, pickedFrom: `first half: quality sensors with precision >= ${PICK_PRECISION}` },
  catchRule: `an event is caught by a detector opening (before merging into alarms) from its first labelled minute to its last, or to ${GRACE_MIN} min after its start if that is later`,
  alarmRule: `each detector event opening on a sensor of the set is an alarm, except one within ${MERGE_MIN} min of the previous alarm; alarms and false alarms are counted after this merge, catches before it`,
  headline: 'quality',
  results,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(evidence) + '\n');
for (const [name, r] of Object.entries(results)) console.log(name.padEnd(8), 'held-out', JSON.stringify(r.heldOut), '\n        ', 'first half', JSON.stringify(r.firstHalf));
console.log(`wrote ${OUT}`);
