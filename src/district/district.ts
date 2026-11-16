// District 7 page (docs/plan.md "Architecture"): the SIMULATED week from the worker, a policy switch, the hum
// emitter, and the gateway that turns a real phone's OK, heard by the microphone, into a LIVE board entry.
// Outside LID scope.
import { createDecoder } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys } from '../core/packet/keys.ts';
import { sevenDay } from '../core/scenario/seven-day.ts';
import { openMic } from '../audio/mic.ts';
import { createModem } from '../audio/modem.ts';
import { toMessage } from './gateway.ts';
import type { Snapshot, ToWorker, View } from './snapshot.ts';

type Policy = keyof Snapshot['views'];
const NAMES: Record<Policy, string> = { directorate: 'Directorate', stratum: 'STRATUM' };
const DEMO = sevenDay.demo, DEMO_S = (DEMO.level - 1) * 4 + DEMO.sector;
const letter = (sector: number) => String.fromCharCode(65 + sector);

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: ToWorker) => worker.postMessage(m);
const query = new URLSearchParams(location.search);
if (query.has('speed')) send({ type: 'speed', n: Math.max(1, Number(query.get('speed')) || 1) }); // test knob: CI plays the week in seconds

let shown: Policy = 'directorate', snap: Snapshot | null = null;

// Run controls and the switch
$('play').onclick = () => send({ type: snap?.playing ? 'pause' : 'play' });
$('restart').onclick = () => send({ type: 'restart', seed: Math.max(1, Math.floor(Number($<HTMLInputElement>('seed').value)) || 1) });
for (const p of ['directorate', 'stratum'] as const) {
  $(`show-${p}`).onclick = () => {
    shown = p;
    for (const q of ['directorate', 'stratum']) $(`show-${q}`).setAttribute('aria-pressed', String(q === p));
    if (snap) render(snap);
  };
}

const num = (v: number) => Number(v.toPrecision(3)).toLocaleString();
const hhmm = (sec: number) => `${String(Math.floor(sec / 3600) % 24).padStart(2, '0')}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}`;
const worldTime = (t: number) => `day ${Math.floor(t / 86400) + 1}, ${hhmm(t)}`;
const put = (el: HTMLElement, s: string) => { if (el.textContent !== s) el.textContent = s; }; // live regions speak only on change

function drawMap(v: View) {
  const W = 90, H = 64, X = 36, Y = 22, svg = $('map') as unknown as SVGSVGElement;
  let out = [0, 1, 2, 3].map((c) => `<text x="${X + c * (W + 4) + W / 2}" y="14" text-anchor="middle" class="axis">${letter(c)}</text>`).join('');
  v.cells.forEach((c, s) => {
    const level = Math.floor(s / 4) + 1, x = X + (s % 4) * (W + 4), y = Y + (level - 1) * (H + 4);
    const state = c.served >= 0.999 ? 'lit' : c.served > 0 ? 'dim' : 'dark';
    const marks = [c.hot && 'H', c.flooded && 'F', c.unsafe && 'W', c.medicine && 'M'].filter(Boolean).join(' ');
    const demo = s === DEMO_S;
    if (s % 4 === 0) out += `<text x="2" y="${y + H / 2 + 5}" class="axis">L${level}</text>`;
    out += `<g class="${state}"><title>Level ${level} sector ${letter(s % 4)}${demo ? ', demo family' : ''}: power ${Math.round(c.served * 100)}%, wet-bulb ${c.wetBulb.toFixed(1)} °C, sump ${Math.round(c.sump * 100)}%${c.flooded ? ', flooded' : ''}${c.unsafe ? ', unsafe water' : ''}${c.medicine ? ', medicine sent' : ''}. SIMULATED</title>
      <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="4" class="${demo ? 'demo' : ''}"/>
      <rect x="${x + W - 9}" y="${y + H - c.sump * (H - 4) - 2}" width="7" height="${c.sump * (H - 4)}" class="sump"/>
      <text x="${x + 6}" y="${y + 17}">${demo ? '★ ' : ''}${Math.round(c.served * 100)}%</text>
      <text x="${x + 6}" y="${y + 35}">${c.wetBulb.toFixed(1)}°</text>
      <text x="${x + 6}" y="${y + 55}" class="marks">${marks}</text></g>`;
  });
  svg.innerHTML = out;
  const n = (k: (c: View['cells'][number]) => boolean) => v.cells.filter(k).length;
  svg.setAttribute('aria-label', `District 7 cross-section, SIMULATED: ${n((c) => c.served === 0)} sectors without power, ${n((c) => c.served > 0 && c.served < 0.999)} trimmed, ${n((c) => c.flooded)} flooded, ${n((c) => c.unsafe)} with unsafe water, ${n((c) => c.hot)} above the heat limit. The demo family's sector has ${Math.round(v.cells[DEMO_S].served * 100)}% power.`);
}

function render(s: Snapshot) {
  const other: Policy = shown === 'directorate' ? 'stratum' : 'directorate';
  const v = s.views[shown], o = s.views[other];
  put($('play'), s.playing ? 'Pause' : s.done ? 'Week ended' : 'Play');
  $<HTMLButtonElement>('play').disabled = s.done;
  put($('act'), `${s.act.title} · ${s.act.mode === 'realtime' ? 'REAL TIME' : `TIME-LAPSE x${s.act.scale ?? 3600}`}${s.playing ? '' : ' · paused'}`);
  const clock = $('clock');
  clock.dataset.t = String(v.t);
  put(clock, `World time ${worldTime(v.t)} · grid ${v.f.toFixed(3)} Hz, ${v.tier} · ${NAMES[shown]} rule, seed ${s.seed} · SIMULATED`);
  drawMap(v);

  put($('shownHead'), `${NAMES[shown]} (shown)`);
  put($('otherHead'), NAMES[other]);
  $('metrics').innerHTML = Object.entries(v.metrics).map(([id, m]) =>
    `<tr><th scope="row">${m.name}<br><span class="small muted">${id} · ${m.unit} · ${m.label}</span></th><td>${num(m.value)}</td><td>${num(o.metrics[id as keyof View['metrics']]!.value)}</td></tr>`).join('');

  const rows = Object.entries(v.board).map(([member, e]) => {
    const when = e.label === 'LIVE' ? new Date(e.minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : worldTime(e.minute * 60);
    return `<li><strong>Member ${member}</strong>: I am OK, sent ${when} · level ${e.level}, sector ${letter(e.sector)} · <span class="tag">${e.label}</span></li>`;
  });
  const board = $('board'), html = rows.join('') || '<li class="muted">No OK heard from this family yet. Listen for phones below.</li>';
  if (board.innerHTML !== html) board.innerHTML = html;

  hum?.set(v.f, soundOn && v.cells[DEMO_S].served > 0); // a dark level hears no hum
}

worker.onmessage = (e: MessageEvent<Snapshot>) => render((snap = e.data));

// Emitter: hum at f and 2f, as judge mode does. In a REAL TIME act f is on the worker's audio clock.
let ctx: AudioContext | null = null, soundOn = false;
let hum: { set(f: number, on: boolean): void } | null = null;
const audio = () => (ctx ??= new AudioContext());

$('sound').onclick = () => {
  soundOn = !soundOn;
  put($('sound'), soundOn ? 'Sound: on' : 'Sound: off');
  if (!hum) {
    const c = audio(); // inside the click: browsers allow sound only after a gesture
    void c.resume();
    const master = new GainNode(c, { gain: 0 });
    master.connect(new BiquadFilterNode(c, { type: 'lowpass', frequency: 1700 })).connect(c.destination); // frequency plan: hum below 1.7 kHz
    const osc = [1, 2].map((h) => {
      const o = new OscillatorNode(c, { frequency: 400 * h });
      o.connect(new GainNode(c, { gain: h === 1 ? 0.03 : 0.06 })).connect(master);
      o.start();
      return o;
    });
    hum = {
      set(f, on) {
        osc.forEach((o, i) => o.frequency.setTargetAtTime(f * (i + 1), c.currentTime, 0.1));
        master.gain.setTargetAtTime(on ? 1 : 0, c.currentTime, 0.05);
      },
    };
  }
  if (snap) render(snap);
};

// Gateway: the demo family's keys, the real codec, and both runs.
let decode: ReturnType<typeof createDecoder> | null = null;
async function useWords() {
  const k = await deriveKeys($<HTMLInputElement>('words').value, DEMO.id); // the key set id is the household id, so an OK lands on its board
  decode = 'error' in k ? null : createDecoder([k], await publicKeys());
  put($('wordsErr'), 'error' in k ? (k.error === 'word-count' ? 'Type exactly six words.' : `"${k.word}" is not one of the family words.`) : '');
}
const ready = useWords();
$('words').onchange = () => void useWords();

function log(text: string) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} · ${text} · LIVE`;
  $('heard').prepend(li);
  while ($('heard').children.length > 20) $('heard').lastElementChild!.remove();
}

/** The one path every heard packet takes, from the microphone or the test seam. */
async function heard(bytes: Uint8Array) {
  await ready;
  if (!decode) return log('Rejected: set six family words first');
  const r = toMessage(await decode(bytes, Date.now()), bytes);
  if (r.message) send({ type: 'inject', message: r.message });
  log(r.note);
}

$('listen').onclick = async () => {
  const btn = $<HTMLButtonElement>('listen'), status = $('listenStatus');
  btn.disabled = true;
  put(status, 'Opening the microphone…');
  try {
    const c = audio();
    const modem = await createModem(c.sampleRate);
    // shortcut: the hum is not lowered while a packet arrives (ggwave reports a packet only once complete); the 1.7 kHz low-pass keeps it out of the packet band
    await openMic(c, (x) => { for (const b of modem.receive(x)) void heard(b); });
    put(btn, 'Listening');
    put(status, 'Listening. Hold a phone within about 1 m and send OK from its Report tab. Sound only: nothing is recorded.');
  } catch (e) {
    btn.disabled = false;
    put(status, `Not listening. ${(e as Error).name === 'NotAllowedError' ? 'Microphone permission was refused: allow it for this page, then try again.' : 'The microphone could not be opened (it needs https and a free microphone).'}`);
  }
};

// Test-only seam: CI has no microphone, so ?test feeds 25 decoded bytes into the same path the modem does.
if (query.has('test')) Object.assign(window, { districtTest: { hear: (b: number[]) => heard(new Uint8Array(b)) } });
