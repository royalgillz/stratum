// District 7 page (docs/plan.md "Architecture"): the SIMULATED week from the worker, a policy switch, the hum
// emitter, and the gateway that turns a real phone's OK, heard by the microphone, into a LIVE board entry.
// Outside src/core.
import { createDecoder, digestPayload, encode, TYPES, type Decoded } from '../core/packet/codec.ts';
import { tally } from '../core/tally/tally.ts';
import { deriveKeys, publicKeys } from '../core/packet/keys.ts';
import { sevenDay } from '../core/scenario/seven-day.ts';
import { stressWeek } from '../core/scenario/stress-week.ts';
import { openMic } from '../audio/mic.ts';
import { createModem } from '../audio/modem.ts';
import { needText, reportText, toMessage } from './gateway.ts';
import { badges, NOISE, PROBLEMS, show, ZERO_BY_RULE } from './problems.ts';
import type { LedgerRow, ScriptName, Snapshot, ToWorker, View } from './snapshot.ts';
import { BANDS } from '../core/adapters/p13.ts';
import { STOCK_DAYS } from '../core/world/lightfood/lightfood.ts';

type Policy = keyof Snapshot['views'];
const NAMES: Record<Policy, string> = { directorate: 'Directorate', stratum: 'STRATUM' };
const NOTES: Record<ScriptName, string> = {
  'seven-day': 'Seven-day week: the scripted week of the demo, with seed-varied event times and sizes.',
  'stress-week': "Stress week: built so STRATUM also loses. Supply falls below every life floor for a day, four levels lose their farms, and three of five surface crews lie. Expect STRATUM to lose on surface truth, its heat person-hours to rise far above the seven-day week's, everyone to fall below the food floor once the shared stores run out, and its trials to prove nothing lighter than the Directorate's (a tie on problem 14).",
};
const SCRIPTS = { 'seven-day': sevenDay, 'stress-week': stressWeek };
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
// rng.ts takes the seed as 32 bits: clamp to that, and show the seed the run uses.
const seedIn = () => {
  const box = $<HTMLInputElement>('seed'), n = Math.min(4294967295, Math.max(1, Math.floor(Number(box.value)) || 1));
  box.value = String(n);
  return n;
};
$('restart').onclick = () => send({ type: 'restart', seed: seedIn() });
for (const k of ['seven-day', 'stress-week'] as const) $(`script-${k}`).onclick = () => send({ type: 'restart', seed: seedIn(), script: k });
for (const p of ['directorate', 'stratum'] as const) {
  $(`show-${p}`).onclick = () => {
    shown = p;
    for (const q of ['directorate', 'stratum']) $(`show-${q}`).setAttribute('aria-pressed', String(q === p));
    if (snap) render(snap);
  };
}

const hhmm = (sec: number) => `${String(Math.floor(sec / 3600) % 24).padStart(2, '0')}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}`;
const worldTime = (t: number) => `day ${Math.floor(t / 86400) + 1}, ${hhmm(t)}`;
const put = (el: HTMLElement, s: string) => { if (el.textContent !== s) el.textContent = s; }; // live regions speak only on change

function drawMap(v: View, p: Policy) {
  const W = 90, H = 64, X = 36, Y = 42, F = W - 14, svg = $('map') as unknown as SVGSVGElement;
  let out = [0, 1, 2, 3].map((c) => `<text x="${X + c * (W + 4) + W / 2}" y="34" text-anchor="middle" class="axis">${letter(c)}</text>`).join('');
  const surface = v.surface === 'unknown' ? 'Surface: no reading yet' : `Surface: ${v.surface} (${p === 'directorate' ? 'official verdict' : "crews' quorum"})`;
  out += `<text x="${X}" y="14" class="surface">${surface}</text>`;
  v.cells.forEach((c, s) => {
    const level = Math.floor(s / 4) + 1, x = X + (s % 4) * (W + 4), y = Y + (level - 1) * (H + 4);
    const state = c.served >= 0.999 ? 'lit' : c.served > 0 ? 'dim' : 'dark';
    const marks = [c.hot && 'H', c.flooded && 'F', c.unsafe && 'W', c.medicine && 'M'].filter(Boolean).join(' ');
    const demo = s === DEMO_S;
    if (s % 4 === 0) out += `<text x="2" y="${y + H / 2 + 5}" class="axis">L${level}</text>`;
    out += `<g class="${state}"><title>Level ${level} sector ${letter(s % 4)}${demo ? ', demo family' : ''}: power ${Math.round(c.served * 100)}%, wet-bulb ${c.wetBulb.toFixed(1)} °C, sump ${Math.round(c.sump * 100)}%, food store ${c.food.toFixed(1)} days${c.flooded ? ', flooded' : ''}${c.unsafe ? ', unsafe water' : ''}${c.medicine ? ', medicine sent' : ''}. SIMULATED</title>
      <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="4" class="${demo ? 'demo' : ''}"/>
      <rect x="${x + W - 9}" y="${y + H - c.sump * (H - 4) - 2}" width="7" height="${c.sump * (H - 4)}" class="sump"/>
      <rect x="${x + 2}" y="${y + H - 6}" width="${F}" height="4" class="food-track"/>
      <rect x="${x + 2}" y="${y + H - 6}" width="${F * Math.min(1, c.food / STOCK_DAYS)}" height="4" class="food"/>
      <text x="${x + 6}" y="${y + 17}">${demo ? '★ ' : ''}${Math.round(c.served * 100)}%</text>
      <text x="${x + 6}" y="${y + 35}">${c.wetBulb.toFixed(1)}°</text>
      <text x="${x + 6}" y="${y + 55}" class="marks">${marks}</text></g>`;
  });
  svg.innerHTML = out;
  // Count and place: "2 sectors without power (L5 A, B; L6 C)", so a screen reader hears where, not only how many.
  const n = (what: string, k: (c: View['cells'][number]) => boolean) => {
    const by: string[][] = [[], [], [], [], [], []];
    v.cells.forEach((c, s) => { if (k(c)) by[Math.floor(s / 4)].push(letter(s % 4)); });
    const at = by.flatMap((ss, l) => (ss.length ? [`L${l + 1} ${ss.join(', ')}`] : [])).join('; ');
    return `${v.cells.filter(k).length} ${what}${at ? ` (${at})` : ''}`;
  };
  svg.setAttribute('aria-label', `District 7 cross-section, SIMULATED: ${[n('sectors without power', (c) => c.served === 0), n('trimmed', (c) => c.served > 0 && c.served < 0.999), n('flooded', (c) => c.flooded), n('with unsafe water', (c) => c.unsafe), n('above the heat limit', (c) => c.hot), n('with an empty food store', (c) => c.food < 0.05)].join(', ')}. ${surface}. The demo family's sector has ${Math.round(v.cells[DEMO_S].served * 100)}% power.`);
}

// The ledger panel: what each kind measures, in plain words; a kind not listed shows its own name.
const KINDS: Record<string, string> = {
  'water.toc': 'Tap water, organic carbon (mg/L)', cases: 'Outbreak cases', 'cases.both': 'Cases on both lists',
  'surface.band': 'Surface verdict (band)', 'surface.co': 'Surface carbon monoxide (ppm)', 'surface.o3': 'Surface ozone (ppm)', 'surface.so2': 'Surface sulfur dioxide (ppm)',
};
const band = (k: string) => k === 'surface.band';
const num = (k: string, x: number | undefined) => (x === undefined ? 'none' : band(k) ? BANDS[x] ?? String(x) : Number.isInteger(x) ? x.toLocaleString() : x.toFixed(2));
function ledgerRow({ kind, where, measured: m, official: o }: LedgerRow) {
  const place = /^L\d$/.test(where) ? `, level ${where.slice(1)}` : '';
  const d = m === undefined || o === undefined ? 'none' : `${m - o > 0 ? '+' : ''}${band(kind) ? `${m - o} band${Math.abs(m - o) === 1 ? '' : 's'}` : num(kind, m - o)}`;
  return `<tr><th scope="row">${KINDS[kind] ?? kind}${place}<br><span class="small muted">SIMULATED</span></th><td>${num(kind, m)}</td><td>${num(kind, o)}</td><td>${d}</td></tr>`;
}

function render(s: Snapshot) {
  const v = s.views[shown];
  put($('play'), s.playing ? 'Pause' : s.done ? 'Week ended' : 'Play');
  if (s.done && document.activeElement === $('play')) $('restart').focus(); // a disabled button drops focus to the page
  $<HTMLButtonElement>('play').disabled = s.done;
  // The level-5 act's cut is the Directorate's: STRATUM trims instead.
  const title = s.act.title + (shown === 'stratum' && s.act.title.startsWith('Level 5 goes dark') ? ' (Directorate rule)' : '');
  put($('act'), s.done ? 'Week ended · press Restart to replay'
    : `${title} · ${s.act.mode === 'realtime' ? 'REAL TIME' : `TIME-LAPSE x${s.act.scale ?? 3600}`}${s.playing ? '' : ' · paused'}`);
  // Why the clock slows: a REAL TIME act plays the sag at the pace a phone hears it (docs/plan.md "Two clocks").
  const acts = SCRIPTS[s.script].acts, next = acts[acts.findIndex((a) => a.atH === s.act.atH) + 1];
  const why = $('actWhy');
  why.hidden = s.done || s.act.mode !== 'realtime';
  put(why, why.hidden ? '' : `REAL TIME: the hum sags at the pace a real phone nearby hears it, so the world clock runs one second per second here.${next ? ` The time-lapse resumes after ${Math.round((next.atH - s.act.atH) * 3600)} s.` : ''}`);
  const clock = $('clock');
  clock.dataset.t = String(v.t);
  put(clock, `World time ${s.done ? `end of day ${SCRIPTS[s.script].days}` : worldTime(v.t)} · grid ${v.f.toFixed(3)} Hz, ${v.tier} · ${NAMES[shown]} rule, seed ${s.seed} · SIMULATED`);
  drawMap(v, shown);
  for (const k of ['seven-day', 'stress-week']) $(`script-${k}`).setAttribute('aria-pressed', String(k === s.script));
  put($('scriptNote'), NOTES[s.script]);

  // The columns never swap: Directorate left, STRATUM right; the drawn rule is marked.
  $('results').dataset.shown = shown;
  for (const p of ['directorate', 'stratum'] as const) {
    const head = p === shown ? `${NAMES[p]} <b>(shown)</b>` : NAMES[p], el = $(`head-${p}`);
    if (el.innerHTML !== head) el.innerHTML = head;
  }
  const metrics = PROBLEMS.map(({ id, title, tier, metric, better }, i) => {
    const m = v.metrics[id], cell = (p: Policy) => {
      const x = s.views[p], r = x.metrics[id], zero = p === 'directorate' && r?.value === 0 && ZERO_BY_RULE[id];
      return x.none[id] ?? (r ? show(r.value, r.unit) + (zero ? ` (${zero})` : '') : 'not yet run');
    };
    return `<tr><th scope="row"><b>${i + 1}. ${title}</b><br><span class="metric">${metric}</span>${id === 'p09' ? `<br><b>${NOISE}, see the 30-day run in the coverage matrix</b>` : ''}<br><span class="small muted">${better} is better · figure: ${m?.label ?? 'SIMULATED'} · Tier: ${badges(tier).map((b) => `<span class="badge">${b}</span>`).join(' ')}</span></th><td>${cell('directorate')}</td><td>${cell('stratum')}</td></tr>`;
  }).join('');
  if ($('metrics').innerHTML !== metrics) $('metrics').innerHTML = metrics;

  const L = v.ledger, ledger = L.rows.map(ledgerRow).join('') || '<tr><td colspan="4" class="muted">No entries yet. Press Play.</td></tr>';
  if ($('ledgerRows').innerHTML !== ledger) $('ledgerRows').innerHTML = ledger;
  const entries = (n: number, what: string) => `${n.toLocaleString()} ${what} entr${n === 1 ? 'y' : 'ies'}`;
  put($('ledgerChain'), `${NAMES[shown]} rule: ${entries(L.measured, 'measured')}, ${entries(L.official, 'official')}, each chained to the one before by SHA‑256 · SIMULATED`
    + (L.measured ? '' : ". No measured entries: the head digest is the empty chain's starting value, the same on every run, so it proves nothing yet."));
  const digest = `<b>${L.digest.slice(0, 12)}</b>${L.digest.slice(12)}`;
  if ($('digest').innerHTML !== digest) $('digest').innerHTML = digest;

  const rows = Object.entries(v.board).map(([member, e]) => {
    const when = e.label === 'LIVE' ? new Date(e.minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : worldTime(e.minute * 60);
    return `<li><strong>Member ${member}</strong>: I am OK, sent ${when} · level ${e.level}, sector ${letter(e.sector)} · <span class="tag">${e.label}</span></li>`;
  });
  // Requests (NEED) heard by the gateway: the runs give them no board row, so the page lists them under the OKs.
  for (const [member, n] of needs) rows.push(`<li><strong>Member ${member}</strong>: ${n.text}, sent ${new Date(n.minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · level ${n.level}, sector ${letter(n.sector)} · <span class="tag">LIVE</span></li>`);
  const board = $('board'), html = rows.join('') || '<li class="muted">Nothing heard from this family yet. Listen for phones below.</li>';
  if (board.innerHTML !== html) board.innerHTML = html;

  hum?.set(v.f, soundOn && v.cells[DEMO_S].served > 0); // a dark level hears no hum
}

worker.onmessage = (e: MessageEvent<Snapshot>) => render((snap = e.data));

// Emitter: hum at f and 2f, as judge mode does. In a REAL TIME act f is on the worker's audio clock.
let ctx: AudioContext | null = null, soundOn = false;
let hum: { set(f: number, on: boolean): void } | null = null;
const audio = () => (ctx ??= new AudioContext());
let modemP: ReturnType<typeof createModem> | null = null; // one ggwave instance sends and hears, as on the phone
const modem = () => (modemP ??= createModem(audio().sampleRate));

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
const needs = new Map<number, { text: string; minute: number; level: number; sector: number }>(); // latest request per member
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

// Heard by sound: every report and public alert, tallied by src/core/tally; this page only renders the rows.
const reports: Decoded[] = [];
const hm = (minute: number) => new Date(minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function renderReports(d: Decoded) {
  reports.push(d);
  if (reports.length > 2000) reports.shift(); // shortcut: a long session forgets its oldest packets, raise if a drill hears more
  const el = (tag: string, text: string, cls = '') => Object.assign(document.createElement(tag), { textContent: text, className: cls });
  const rows = tally(reports).map((t) => {
    const x = reportText(t, hm(t.newest)), li = el('li', '');
    li.append(el('strong', x.what), ` · ${x.detail} · `, el('span', 'LIVE', 'tag'), ...(x.cases ? [el('div', x.cases, 'cases')] : []));
    return li;
  });
  if (rows.length) $('reports').replaceChildren(...rows);
}

/** The one path every heard packet takes, from the microphone or the test seam. */
async function heard(bytes: Uint8Array) {
  await ready;
  if (!decode) return log('Rejected: set six family words first');
  const d = await decode(bytes, Date.now()), r = toMessage(d, bytes);
  if (!('reject' in d) && !d.duplicate) renderReports(d);
  if (r.message) send({ type: 'inject', message: r.message });
  const h = r.message?.heard;
  if (h?.type === TYPES.NEED) needs.set(h.payload.member, { text: needText(h.payload), minute: h.minute, level: h.payload.level, sector: h.payload.sector });
  log(r.note);
}

// Send ledger digest: the shown rule's digest, first 6 bytes, as a public LEDGER_HEAD packet by sound.
const sent: number[][] = []; // test seam: the bytes of each packet played
$('sendDigest').onclick = async () => {
  const btn = $<HTMLButtonElement>('sendDigest'), status = $('sendStatus'), v = snap?.views[shown];
  if (!v) return;
  if (!v.ledger.measured) return put(status, shown === 'directorate'
    ? "Not sent: the Directorate rule keeps no measured record, only its own figures, so its digest is the empty chain's starting value. Click STRATUM rule at the top, then send."
    : "Not sent: the STRATUM rule has no measured entries yet, so its digest is only the empty chain's starting value. Press Play, wait, then send.");
  btn.disabled = true;
  const hexed = v.ledger.digest.slice(0, 12), rule = NAMES[shown];
  try {
    const c = audio(), resumed = c.resume(); // inside the click: browsers allow sound only after a gesture
    const nonce = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 8; // packet design: a fresh nonce from a secure source
    const bytes = await encode(await publicKeys(), { type: TYPES.LEDGER_HEAD, minute: Math.floor(Date.now() / 60000), nonce, hops: 3, payload: digestPayload(v.ledger.digest) });
    sent.push([...bytes]);
    put(status, `Playing digest ${hexed} of the SIMULATED ${rule} ledger…`);
    await resumed;
    const x = (await modem()).encode(bytes);
    const buf = c.createBuffer(1, x.length, c.sampleRate);
    buf.getChannelData(0).set(x);
    const src = new AudioBufferSourceNode(c, { buffer: buf });
    src.connect(c.destination);
    await new Promise((r) => { src.onended = r; src.start(); });
    put(status, `Sent by sound: digest ${hexed} of the SIMULATED ${rule} ledger. A listening phone shows it in its Family tab inbox.`);
  } catch {
    put(status, 'Not sent: sound could not play on this device. Try again.');
  }
  btn.disabled = false;
};

$('listen').onclick = async () => {
  const btn = $<HTMLButtonElement>('listen'), status = $('listenStatus');
  btn.disabled = true;
  put(status, 'Opening the microphone…');
  try {
    const c = audio();
    const m = await modem();
    // shortcut: the hum is not lowered while a packet arrives (ggwave reports a packet only once complete); the 1.7 kHz low-pass keeps it out of the packet band
    await openMic(c, (x) => { for (const b of m.receive(x)) void heard(b); });
    put(btn, 'Listening');
    put(status, 'Listening. Hold a phone within about 1 m and send OK from its Report tab. Sound only: nothing is recorded.');
  } catch (e) {
    btn.disabled = false;
    put(status, `Not listening. ${(e as Error).name === 'ReloadError' ? (e as Error).message : (e as Error).name === 'NotAllowedError' ? 'Microphone permission was refused: allow it for this page, then try again.' : 'The microphone could not be opened (it needs https and a free microphone).'}`);
  }
};

// Test-only seam: CI has no microphone, so ?test feeds 25 decoded bytes into the same path the modem does.
if (query.has('test')) Object.assign(window, { districtTest: { hear: (b: number[]) => heard(new Uint8Array(b)), sent } });
