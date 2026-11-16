// Phone page, rung 1: family words, hum tier, Send OK, inbox. Outside LID scope (src/phone).
import { createTracker, type Reading } from '../core/tracker/tracker.ts';
import { createDecoder, encode, TYPES, type Decoded } from '../core/packet/codec.ts';
import { deriveKeys, generateWords, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { decimator, openMic } from '../audio/mic.ts';
import { createModem } from '../audio/modem.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const TYPE_NAME = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));
const TIER_TEXT = { GREEN: '● NORMAL', AMBER: '▲ WARNING: grid under strain', RED: '■ DANGER: cut likely soon' } as const;

// Per-device conveniences only; the page works without storage (private window).
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* not persisted */ } },
};
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const member = Number(store.get('stratum.member') ?? (store.set('stratum.member', String(random(1)[0])), store.get('stratum.member') ?? random(1)[0]));

let family: KeySet | null = null;
let ctx: AudioContext | null = null;
let modem: Awaited<ReturnType<typeof createModem>> | null = null;
let decode: ReturnType<typeof createDecoder> | null = null;
let quietUntil = 0; // tracker readings are ignored while this phone is transmitting

// ---------- Family ----------

function renderFamily(words: string | null, error = '') {
  const el = $('family');
  if (family && words) {
    el.innerHTML = `<p>Family words (type these on every family phone):</p><p class="words"></p>
      <button id="leave">Leave family</button>`;
    el.querySelector('.words')!.textContent = words;
    el.querySelector<HTMLButtonElement>('#leave')!.onclick = () => {
      if (!confirm('Leave this family? You will need the six words to rejoin.')) return;
      store.set('stratum.words', null);
      family = null;
      decode = null;
      renderFamily(null);
    };
    return;
  }
  el.innerHTML = `<button id="create">Create a family</button>
    <p class="muted">Or join one: type the six words from a family phone.</p>
    <input type="text" id="words" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Six family words" />
    <button id="join">Join family</button><p class="err" role="alert"></p>`;
  el.querySelector('.err')!.textContent = error;
  el.querySelector<HTMLButtonElement>('#create')!.onclick = () => join(generateWords(random(9)).join(' '));
  el.querySelector<HTMLButtonElement>('#join')!.onclick = () => join(el.querySelector<HTMLInputElement>('#words')!.value);
}

async function join(words: string) {
  const k = await deriveKeys(words, 'family');
  if ('error' in k) {
    renderFamily(null, k.error === 'word-count' ? 'Type exactly six words.' : `"${k.word}" is not one of the family words. Check the spelling.`);
    return;
  }
  family = k;
  decode = null; // rebuilt with the new key set
  const normal = words.normalize('NFKD').toLowerCase().trim().split(/\s+/).join(' ');
  store.set('stratum.words', normal);
  renderFamily(normal);
}

// ---------- Audio ----------

async function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    modem = await createModem(ctx.sampleRate);
  }
  await ctx.resume();
  return { ctx, modem: modem! };
}

async function decoder() {
  decode ??= createDecoder(family ? [family] : [], await publicKeys());
  return decode;
}

// ---------- Listen ----------

function showReading(r: Reading) {
  const tier = $('tier'), dev = $('dev');
  tier.className = r.tier ?? '';
  if (r.state === 'NO_HUM') {
    tier.textContent = 'NO HUM';
    dev.textContent = 'No grid sound heard. Move closer to a powered wall or machine.';
  } else if (r.state === 'CALIBRATING') {
    tier.textContent = 'Calibrating…';
    dev.textContent = 'Learning this grid’s normal sound, about 30 s. Keep the phone still.';
  } else if (r.tier) {
    tier.textContent = TIER_TEXT[r.tier];
    dev.textContent = `${r.deviationMHz! >= 0 ? '+' : ''}${r.deviationMHz!.toFixed(1)} mHz from normal · ${r.label}`;
  }
}

$('listen').onclick = async () => {
  const btn = $<HTMLButtonElement>('listen');
  btn.disabled = true;
  try {
    const { ctx, modem } = await audio();
    const dec = decimator(ctx.sampleRate);
    const tracker = createTracker({ sampleRate: dec.rate, label: 'LIVE' });
    const s = await openMic(ctx, (x) => {
      const rs = tracker.push(dec.push(x));
      if (rs.length && performance.now() > quietUntil) showReading(rs[rs.length - 1]);
      for (const bytes of modem.receive(x)) void receive(bytes);
    });
    btn.textContent = 'Listening';
    $('micinfo').textContent = s.echoCancellation || s.noiseSuppression || s.autoGainControl
      ? 'Warning: this browser kept some microphone processing on; readings may be less accurate.'
      : '';
  } catch (e) {
    btn.disabled = false;
    $('tier').textContent = 'Not listening';
    $('dev').textContent = `Could not open the microphone: ${(e as Error).message}`;
  }
};

// ---------- Report ----------

for (let l = 1; l <= 6; l++) $('level').append(new Option(String(l), String(l)));
for (let s = 0; s < 4; s++) $('sector').append(new Option(String.fromCharCode(65 + s), String(s)));
$<HTMLSelectElement>('level').value = store.get('stratum.level') ?? '5';
$<HTMLSelectElement>('sector').value = store.get('stratum.sector') ?? '0';
$('level').onchange = () => store.set('stratum.level', $<HTMLSelectElement>('level').value);
$('sector').onchange = () => store.set('stratum.sector', $<HTMLSelectElement>('sector').value);

$('sendOk').onclick = async () => {
  if (!family) {
    $('sent').textContent = 'Create or join a family first.';
    return;
  }
  const btn = $<HTMLButtonElement>('sendOk');
  btn.disabled = true;
  try {
    const { ctx, modem } = await audio();
    const n = random(3);
    const bytes = await encode(family, {
      type: TYPES.OK,
      minute: Math.floor(Date.now() / 60000),
      nonce: (n[0] << 16) | (n[1] << 8) | n[2],
      hops: 3,
      payload: {
        member, code: 0,
        level: Number($<HTMLSelectElement>('level').value), sector: Number($<HTMLSelectElement>('sector').value),
        flags: $<HTMLInputElement>('power').checked ? 1 : 0, value: 0,
      },
    });
    const x = modem.encode(bytes);
    const buf = ctx.createBuffer(1, x.length, ctx.sampleRate);
    buf.getChannelData(0).set(x);
    const src = new AudioBufferSourceNode(ctx, { buffer: buf });
    src.connect(ctx.destination);
    quietUntil = performance.now() + buf.duration * 1000 + 2500; // our own chirp is loud: skip readings
    $('sent').textContent = 'Sending… keep the phone still.';
    await new Promise((r) => { src.onended = r; src.start(); });
    $('sent').textContent = `OK sent at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
  } finally {
    btn.disabled = false;
  }
};

// ---------- Inbox ----------

async function receive(bytes: Uint8Array) {
  const r = await (await decoder())(bytes, Date.now());
  if ('reject' in r) return; // not for us, damaged or replayed: say nothing
  addToInbox(r);
}

function addToInbox(r: Decoded) {
  const p = r.payload;
  const when = new Date(r.minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const where = `level ${p.level}, sector ${String.fromCharCode(65 + p.sector)}`;
  const text = `${when} · ${TYPE_NAME[r.type] ?? r.type} from member ${p.member} · ${where} · power ${p.flags & 1 ? 'on' : 'off'}`
    + (r.public ? ' · public' : '') + (r.duplicate ? ` · heard ${r.timesHeard}×` : '');
  const li = document.createElement('li');
  li.textContent = text;
  $('inbox').prepend(li);
}

const saved = store.get('stratum.words');
if (saved) void join(saved);
else renderFamily(null);
