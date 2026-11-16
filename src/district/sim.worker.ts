// District 7 simulation worker: both policies side by side from one seed, ticked by real elapsed time,
// so the page's policy switch is instant and both always show the same world time (scenario design, "The switch").
import { createRun, type Run } from '../core/scenario/run.ts';
import { sevenDay } from '../core/scenario/seven-day.ts';
import { stressWeek } from '../core/scenario/stress-week.ts';
import { audioClock, view, type AudioClock, type ScriptName, type Snapshot, type ToWorker } from './snapshot.ts';

const POST_MS = 200; // snapshots per second: 5
const MAX_TICK_S = 1; // a backgrounded tab resumes with at most 1 s of real time, so it never freezes catching up

const SCRIPTS = { 'seven-day': sevenDay, 'stress-week': stressWeek };
let script: ScriptName = 'seven-day', seed = 1, playing = false, speed = 1, last = performance.now();
let runs: [Run, Run], clocks: (AudioClock | null)[] = [null, null];

// Check mode off: the write guard costs several times the step time, and the core tests run every adapter checked.
const restart = (s: number, name: ScriptName = script) => {
  const sc = SCRIPTS[(script = name)];
  runs = [createRun(sc, (seed = s), 'directorate', { check: false }), createRun(sc, s, 'stratum', { check: false })];
  clocks = [null, null];
};

function post() {
  const [d, s] = runs;
  postMessage({ seed, script, playing, done: d.done(), act: d.act(), views: { directorate: view(d, sevenDay.demo.id, clocks[0]), stratum: view(s, sevenDay.demo.id, clocks[1]) /* both scripts share the demo household */ } } satisfies Snapshot);
}

onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === 'play') playing = true;
  else if (m.type === 'pause') playing = false;
  else if (m.type === 'restart') restart(m.seed, m.script);
  else if (m.type === 'speed') speed = m.n;
  else runs.forEach((r) => r.inject(m.message)); // a live packet goes into both runs
  post();
};

restart(1);
setInterval(() => {
  const now = performance.now(), dt = Math.min(MAX_TICK_S, (now - last) / 1000) * speed;
  last = now;
  if (!playing) return; // paused: messages post their own snapshot
  for (const r of runs) r.tick(dt);
  clocks = runs.map((r, i) => audioClock(r, clocks[i] ?? null, dt));
  if (runs[0].done()) playing = false;
  post();
}, POST_MS);
post();
