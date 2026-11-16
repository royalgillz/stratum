import { openMic } from './mic.ts';

declare const ggwave_factory: () => Promise<any>; // classic script from public/vendor/ggwave

const N = 20, GAP_MS = 1000, VOLUME = 50;
const $ = (id: string) => document.getElementById(id)!;

// Packet seq: byte 0 is the sequence number, the other 24 bytes are a fixed pattern to verify.
const payload = (seq: number) => Uint8Array.from({ length: 25 }, (_, i) => (i === 0 ? seq : (seq * 31 + i * 7) & 255));
const valid = (r: Uint8Array) => r.length === 25 && payload(r[0]).every((v, i) => v === r[i]);

const g = await ggwave_factory();
g.disableLog();
const ctx = new AudioContext();
const params = g.getDefaultParameters();
params.sampleRateInp = ctx.sampleRate;
params.sampleRateOut = ctx.sampleRate;
const inst = g.init(params);

// encode returns a view into wasm memory holding float32 samples as bytes: copy it out.
function encode(bytes: Uint8Array): Float32Array {
  const w: Int8Array = g.encode(inst, bytes, g.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, VOLUME);
  return new Float32Array(w.buffer.slice(w.byteOffset, w.byteOffset + w.length));
}
function decode(samples: Float32Array): Uint8Array | null {
  const r: Int8Array = g.decode(inst, new Int8Array(samples.buffer, samples.byteOffset, samples.byteLength));
  return r.length ? new Uint8Array(r) : null; // wraps -56 to 200 and copies out of wasm memory
}

async function keyCheck(): Promise<string> {
  try {
    const ikm = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(16)), 'HKDF', false, ['deriveKey']);
    const kmac = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new TextEncoder().encode('mac') },
      ikm, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', kmac, payload(0));
    return mac.byteLength === 32 ? 'HKDF + HMAC: OK' : 'HKDF + HMAC: FAIL (wrong length)';
  } catch (e) {
    return `HKDF + HMAC: FAIL (${e})`;
  }
}

const loop = decode(encode(payload(7)));
$('checks').textContent = `Sample rate ${ctx.sampleRate} | ggwave loopback 25 bytes: ${loop && valid(loop) ? 'OK' : 'FAIL'} | ${await keyCheck()}`;

async function play(seq: number) {
  await ctx.resume();
  const x = encode(payload(seq));
  const buf = ctx.createBuffer(1, x.length, ctx.sampleRate);
  buf.getChannelData(0).set(x);
  const src = new AudioBufferSourceNode(ctx, { buffer: buf });
  src.connect(ctx.destination);
  const ended = new Promise((r) => (src.onended = r));
  src.start();
  await ended;
}

let busy = false;
async function sendMany(count: number) {
  if (busy) return;
  busy = true;
  for (let seq = 0; seq < count; seq++) {
    $('sent').textContent = `sending ${seq + 1}/${count}`;
    await play(seq);
    await new Promise((r) => setTimeout(r, GAP_MS));
  }
  $('sent').textContent = `sent ${count}`;
  busy = false;
}
$('send20').onclick = () => sendMany(N);
$('send1').onclick = () => sendMany(1);

const got = new Set<number>();
let bad = 0;
function show() {
  $('got').textContent = `${got.size}/${N} OK, ${bad} bad`;
  $('seqs').textContent = `seqs: ${[...got].sort((a, b) => a - b).join(' ')}`;
}
$('reset').onclick = () => { got.clear(); bad = 0; show(); };

$('listen').onclick = async () => {
  ($('listen') as HTMLButtonElement).disabled = true;
  const frame = new Float32Array(1024); // ggwave's samplesPerFrame
  let k = 0;
  show();
  // shortcut: assumes 128-sample render blocks (1024 / 128 = 8); revisit if renderSizeHint changes it.
  $('settings').textContent = await openMic(ctx, (x) => {
    frame.set(x, k);
    k += x.length;
    if (k < frame.length) return;
    k = 0;
    const r = decode(frame);
    if (!r) return;
    if (valid(r)) got.add(r[0]); else bad++;
    show();
  });
};
