import { save, stamp } from './save.ts';

const $ = (id: string) => document.getElementById(id)!;
const slider = $('offset') as HTMLInputElement;
const RAMP_S = 60;

// Every button press with wall-clock time, to line up with the listener's export.
const rows = ['wall_time,action,offset_mHz_after'];
const note = (action: string) => rows.push(`${new Date().toISOString()},${action},${(offset * 1000).toFixed(1)}`);

let ctx: AudioContext | null = null;
let oscs: [OscillatorNode, number][] = []; // [oscillator, harmonic]
let offset = 0; // grid offset in Hz; during a ramp, the target
let ramp: { t0: number; from: number } | null = null;

// The offset sounding right now, including a ramp in progress.
function current(): number {
  if (!ctx || !ramp) return offset;
  const k = Math.min(1, (ctx.currentTime - ramp.t0) / RAMP_S);
  return ramp.from + (offset - ramp.from) * k;
}

function set(d: number) {
  offset = d;
  ramp = null;
  slider.value = String(d);
  if (!ctx) return;
  for (const [o, h] of oscs) {
    o.frequency.cancelScheduledValues(ctx.currentTime);
    o.frequency.setValueAtTime(h * (400 + d), ctx.currentTime);
  }
}

$('start').onclick = () => {
  if (ctx) return;
  const c = (ctx = new AudioContext());
  ramp = null;
  oscs = ([[1, 0.15], [2, 0.3]] as const).map(([h, level]) => {
    const o = new OscillatorNode(c, { frequency: h * (400 + offset) });
    o.connect(new GainNode(c, { gain: level })).connect(c.destination);
    o.start();
    return [o, h];
  });
  note('START');
};
$('stop').onclick = () => { offset = current(); ramp = null; ctx?.close(); ctx = null; oscs = []; note('STOP'); };
slider.oninput = () => set(+slider.value);
slider.onchange = () => note('SLIDER'); // once per drag, not per pixel
$('zero').onclick = () => { set(0); note('OFFSET_0'); };
$('step').onclick = () => { set(current() + 0.1); note('STEP'); };
$('export').onclick = () => save(`emitter-${stamp()}.csv`, rows.join('\n'));
$('ramp').onclick = () => {
  if (!ctx) return;
  const from = current(), t = ctx.currentTime;
  for (const [o, h] of oscs) {
    o.frequency.cancelScheduledValues(t);
    o.frequency.setValueAtTime(h * (400 + from), t);
    o.frequency.linearRampToValueAtTime(h * (400 + from - 0.1), t + RAMP_S);
  }
  offset = from - 0.1;
  ramp = { t0: t, from };
  note('RAMP_START'); // offset column = ramp target; the ramp ends RAMP_S later
};

setInterval(() => {
  const d = current();
  $('now').textContent = `${d >= 0 ? '+' : ''}${(d * 1000).toFixed(1)} mHz (${(400 + d).toFixed(4)} Hz)` + (ctx ? '' : ' stopped');
}, 100);
