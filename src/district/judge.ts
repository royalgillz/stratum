// Judge mode (docs/plan.md "Judge mode"): a 90 s scripted story that feeds SIMULATED hum through the
// real tracker and a real OK packet through the real codec. No microphone. Outside LID scope.
import { createTracker, type Reading } from '../core/tracker/tracker.ts';
import { createDecoder, encode, TYPES } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { rng } from '../core/rng.ts';

const SR = 8000, END = 90, CUT = 80, OK_AT = 85;
const DEMO_WORDS = 'abandon ability able about above absent'; // a fixed demo family

// ?speed=N only shortens the timeline for automated tests; judges get real time.
const speed = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);

/** Grid offset in Hz at story time t, or null once the power is cut. */
const offset = (t: number) =>
  t < 50 ? 0 : t < 70 ? (-0.1 * (t - 50)) / 20 : t < CUT ? -0.1 - 0.1 * Math.min(1, (t - 70) / 5) : null;

const CAPTIONS: [number, string][] = [
  [0, 'Every powered machine hums at the grid frequency. In the Hollow the grid runs at 400 Hz, so the hum is 400 and 800 Hz. The phone listens and learns this grid\'s normal pitch: about 30 seconds of calibration.'],
  [32, 'The phone finishes calibrating and shows GREEN: the grid is normal. It tracks the pitch to a thousandth of a hertz.'],
  [50, 'Demand outgrows supply. The generators slow and the hum sags slowly, 100 mHz over 20 seconds. The phone warns: AMBER.'],
  [70, 'The shortfall deepens to 200 mHz below normal. RED, DANGER: a cut is likely soon. Fill water, save charge, move to the light.'],
  [CUT, 'Power cut. The hum stops, so the phone shows NO HUM. The warning works before a cut, not during one (docs/limits.md).'],
  [OK_AT, 'A family member sends OK by sound. The phone decodes the 25-byte packet with the real codec and shows it in the inbox.'],
  [END, 'End of the story. The tracker and the codec are the real code; the grid, the hum and the message are SIMULATED.'],
];

const SHOW = {
  CALIBRATING: '◌ CALIBRATING',
  GREEN: '● GREEN: normal',
  AMBER: '▲ AMBER: WARNING, grid under strain',
  RED: '■ RED: DANGER, cut likely soon',
  'NO HUM': '○ NO HUM',
} as const;
type Shown = keyof typeof SHOW;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const play = $<HTMLButtonElement>('play'), mute = $<HTMLButtonElement>('mute');

if (speed !== 1) {
  $('speedNote').hidden = false;
  $('speedNote').textContent = `TEST SPEED x${speed}: the timeline is shortened for automated tests. Remove ?speed from the address for real time.`;
}

const addr = new URL('../phone/', location.href).href;
$('addr').textContent = addr;
$('copy').onclick = () =>
  navigator.clipboard.writeText(addr).then(
    () => ($('copied').textContent = 'Copied.'),
    () => ($('copied').textContent = 'Could not copy: select the address and copy it by hand.'),
  );

let muted = false;
let master: GainNode | null = null;
mute.onclick = () => {
  muted = !muted;
  mute.setAttribute('aria-pressed', String(muted));
  mute.textContent = muted ? 'Sound: muted' : 'Sound: on';
  if (master) master.gain.value = muted ? 0 : 1;
};

/** Optional audible hum: two oscillators following the same offset, at low volume. */
function startSound() {
  try {
    const ctx = new AudioContext();
    master = new GainNode(ctx, { gain: muted ? 0 : 1 });
    master.connect(ctx.destination);
    const hum = new GainNode(ctx);
    hum.connect(master);
    const osc = [1, 2].map((h) => {
      const o = new OscillatorNode(ctx, { frequency: 400 * h });
      o.connect(new GainNode(ctx, { gain: h === 1 ? 0.03 : 0.06 })).connect(hum);
      o.start();
      return o;
    });
    return {
      set(off: number | null) {
        if (off === null) return void (hum.gain.value = 0); // the cut silences the room
        osc.forEach((o, i) => o.frequency.setValueAtTime((400 + off) * (i + 1), ctx.currentTime));
      },
      close: () => void ctx.close(),
    };
  } catch {
    return { set() {}, close() {} }; // no Web Audio: the captions still carry the story
  }
}

function showReading(r: Reading) {
  const tier = $('tier'), dev = $('dev');
  const name: Shown | null = r.state === 'NO_HUM' ? 'NO HUM' : r.state === 'CALIBRATING' ? 'CALIBRATING' : (r.tier ?? null);
  if (r.state === 'NO_HUM') dev.textContent = 'No grid sound heard. The warning works before a cut, not during one.';
  else if (r.deviationMHz !== undefined) dev.textContent = `${r.deviationMHz >= 0 ? '+' : ''}${r.deviationMHz.toFixed(1)} mHz from normal · ${r.label}`;
  else dev.textContent = `Hum at ${r.f!.toFixed(3)} Hz · ${r.label}`;
  if (!name || tier.dataset.tier === name) return;
  tier.dataset.tier = name;
  tier.textContent = SHOW[name];
  $('seq').append(Object.assign(document.createElement('li'), { textContent: name }));
}

async function deliverOk(family: KeySet) {
  const bytes = await encode(family, {
    type: TYPES.OK, minute: Math.floor(Date.now() / 60000), nonce: crypto.getRandomValues(new Uint32Array(1))[0] >>> 8, hops: 0,
    payload: { member: 12, code: 0, level: 3, sector: 1, flags: 0, value: 0 },
  });
  const r = await createDecoder([family], await publicKeys())(bytes, Date.now());
  const inbox = $('inbox');
  if ('reject' in r) {
    inbox.textContent = `Packet rejected: ${r.reject}`; // never expected: same keys both ends
    return;
  }
  const p = r.payload, time = new Date(r.minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const li = document.createElement('li');
  li.innerHTML = `<strong>✓ OK</strong> from member ${p.member} · level ${p.level}, sector ${String.fromCharCode(65 + p.sector)} · power ${p.flags & 1 ? 'on' : 'off'} · sent ${time} · SIMULATED<br><code class="small"></code>`;
  li.querySelector('code')!.textContent = `${bytes.length} bytes: ${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`;
  inbox.replaceChildren(li);
}

play.onclick = async () => {
  play.disabled = true;
  play.textContent = 'Playing…';
  const sound = startSound(); // inside the click: browsers allow sound only after a gesture
  const family = (await deriveKeys(DEMO_WORDS, 'family')) as KeySet;
  $('story').hidden = false;
  $('seq').replaceChildren();
  $('inbox').innerHTML = '<li class="muted">No messages yet</li>';
  delete $('tier').dataset.tier;
  $('tier').textContent = 'Waiting for 2 s of hum';
  $('dev').textContent = '';

  const tracker = createTracker({ sampleRate: SR, label: 'SIMULATED' });
  const noise = rng(1, 'judge');
  let p1 = 0, p2 = 0, n = 0, caption = -1, delivered = false;
  const t0 = performance.now();

  const tick = () => {
    const t = Math.min(END, ((performance.now() - t0) / 1000) * speed);
    // Hum synthesized exactly as src/core/tracker/tracker.test.ts does, sample by sample up to now.
    const x = new Float32Array(Math.floor(t * SR) - n);
    for (let i = 0; i < x.length; i++, n++) {
      const off = offset(n / SR);
      if (off === null) continue; // power cut: digital silence
      p1 += (2 * Math.PI * (400 + off)) / SR;
      p2 += (2 * Math.PI * 2 * (400 + off)) / SR;
      x[i] = 0.15 * Math.sin(p1) + 0.3 * Math.sin(p2) + 0.01 * (noise() * 2 - 1);
    }
    tracker.push(x).forEach(showReading);

    const off = offset(t);
    sound.set(off);
    $('time').textContent = `Story time ${Math.floor(t)} s of ${END} s`;
    $('offset').textContent = off === null ? 'Grid fed in: power cut · SIMULATED' : `Grid fed in: ${(off * 1000).toFixed(0)} mHz from normal · SIMULATED`;
    const c = CAPTIONS.filter(([s]) => t >= s).length - 1;
    if (c !== caption) $('caption').textContent = CAPTIONS[(caption = c)][1];
    if (!delivered && t >= OK_AT) {
      delivered = true;
      void deliverOk(family);
    }
    if (t >= END) {
      clearInterval(timer);
      sound.close();
      play.disabled = false;
      play.textContent = 'Play the story again';
    }
  };
  const timer = setInterval(tick, 100);
};
