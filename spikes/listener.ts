import { openMic } from './mic.ts';
import { track } from './tonebank.ts';
import { save, stamp } from './save.ts';

// Spike values from docs/handoff.md (2 s window, 0.5 s hop, 30 s calibration). MIN_SNR_DB is a guess.
const WIN_S = 2, HOP_S = 0.5, CAL_S = 30, MIN_SNR_DB = 13;
const $ = (id: string) => document.getElementById(id)!;
const sign = (v: number, d: number) => (v >= 0 ? '+' : '') + v.toFixed(d);

let cal: number[] = [];
let ref: number | null = null;
// Every reading since Start, for export. Wall-clock time lines it up with the emitter's log.
const rows = ['wall_time,t_s,state,dev_mHz,grid_Hz,snr_dB'];
$('recal').onclick = () => { cal = []; ref = null; rows.push(`${new Date().toISOString()},,RECALIBRATE,,,`); };
$('export').onclick = () => save(`listener-${stamp()}.csv`, rows.join('\n'));

$('start').onclick = async () => {
  ($('start') as HTMLButtonElement).disabled = true;
  const ctx = new AudioContext();
  const sr = ctx.sampleRate, n = WIN_S * sr, hop = HOP_S * sr;
  const ring = new Float32Array(n);
  let w = 0, total = 0, sinceHop = 0;
  const log: string[] = [];

  $('settings').textContent = await openMic(ctx, (x) => {
    for (const v of x) { ring[w] = v; w = (w + 1) % n; }
    total += x.length;
    sinceHop += x.length;
    if (total < n || sinceHop < hop) return;
    sinceHop = 0;

    const win = new Float32Array(n);
    win.set(ring.subarray(w));
    win.set(ring.subarray(0, w), n - w);
    const { f, snrDb } = track(win, sr, 795, 805);
    const grid = f / 2; // the 800 Hz component is the second harmonic of a 400 Hz grid
    const t = (total / sr).toFixed(1).padStart(6);

    let big: string, state: string, dev = '';
    if (snrDb < MIN_SNR_DB) { big = 'NO HUM'; state = 'NO_HUM'; }
    else if (ref === null) {
      cal.push(grid);
      big = `CALIBRATING ${cal.length * HOP_S}/${CAL_S} s`;
      state = 'CAL';
      if (cal.length * HOP_S >= CAL_S) ref = cal.reduce((s, v) => s + v, 0) / cal.length;
    } else {
      dev = ((grid - ref) * 1000).toFixed(2);
      big = `${sign(+dev, 1)} mHz LIVE`;
      state = 'LIVE';
    }
    // grid_Hz is the raw estimate even under NO_HUM: kept for analysis, never shown as a reading.
    rows.push(`${new Date().toISOString()},${(total / sr).toFixed(2)},${state},${dev},${grid.toFixed(5)},${snrDb.toFixed(1)}`);

    $('big').textContent = big;
    $('info').textContent = `grid ${grid.toFixed(4)} Hz | snr ${snrDb.toFixed(0)} dB` +
      (ref === null ? '' : ` | calibration offset ${sign((ref - 400) * 1000, 1)} mHz`);
    log.unshift(`${t} s  ${big.padEnd(24)} snr ${snrDb.toFixed(0)} dB`);
    log.length = Math.min(log.length, 20); // on-screen glance only; Export has everything
    $('log').textContent = log.join('\n');
  });
};
