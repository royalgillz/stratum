// Self-checks for the audio adapters: ggwave loopback through the real codec, and decimated hum.
import { describe, expect, it } from 'vitest';
import { createDecoder, encode, TYPES } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { createTracker } from '../core/tracker/tracker.ts';
import { decimator } from './mic.ts';
import { createModem } from './modem.ts';

// The browser loads ggwave as a classic script. Here "type": "module" would treat it as ESM, so run it as CommonJS.
// Node built-ins via process.getBuiltinModule: the project has no @types/node.
const node = (globalThis as any).process;
const file = new URL('../../public/vendor/ggwave/ggwave.js', import.meta.url);
const mod = { exports: {} as unknown };
new Function('require', 'module', 'exports', '__dirname', '__filename', node.getBuiltinModule('fs').readFileSync(file, 'utf8'))(
  node.getBuiltinModule('module').createRequire(file), mod, mod.exports, '.', file.pathname);
(globalThis as any).ggwave_factory = mod.exports;

describe('audio adapters', () => {
  it('carries a 25-byte packet through ggwave in 128-sample mic blocks', async () => {
    const fam = (await deriveKeys('abandon ability able about above absent', 'family')) as KeySet;
    const minute = Math.floor(Date.now() / 60000);
    const bytes = await encode(fam, { type: TYPES.OK, minute, nonce: 4242, hops: 3, payload: { member: 9, code: 0, level: 5, sector: 2, flags: 1, value: 0 } });
    const modem = await createModem(48000);
    const sound = modem.encode(bytes);
    const heard: Uint8Array[] = [];
    const padded = new Float32Array(sound.length + 48000);
    padded.set(sound, 24000);
    for (let i = 0; i < padded.length; i += 128) heard.push(...modem.receive(padded.subarray(i, i + 128)));
    expect(heard).toHaveLength(1);
    const r = await createDecoder([fam], await publicKeys())(heard[0], Date.now());
    expect(r).toMatchObject({ type: TYPES.OK, payload: { member: 9, level: 5, sector: 2, flags: 1 } });
  }, 30_000);

  it('decimates 48 kHz hum to 8 kHz without losing the tracker its RED', () => {
    const sr = 48000, dec = decimator(sr);
    expect(dec.rate).toBe(8000);
    const tracker = createTracker({ sampleRate: dec.rate, label: 'LIVE' });
    let p1 = 0, p2 = 0, last;
    for (let s = 0; s < 42; s++) {
      const off = s < 35 ? 0 : -0.2;
      const x = new Float32Array(sr);
      for (let i = 0; i < sr; i++) {
        p1 += (2 * Math.PI * (400 + off)) / sr;
        p2 += (2 * Math.PI * 2 * (400 + off)) / sr;
        x[i] = 0.15 * Math.sin(p1) + 0.3 * Math.sin(p2);
      }
      for (let i = 0; i < sr; i += 128) last = tracker.push(dec.push(x.subarray(i, i + 128))).at(-1) ?? last;
    }
    expect(last!.tier).toBe('RED');
    expect(last!.deviationMHz).toBeGreaterThan(-205);
    expect(last!.deviationMHz).toBeLessThan(-195);
  });
});
