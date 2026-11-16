// Shared phone services: family keys, one audio context, one microphone stream, one decoder.
// Screens subscribe to events instead of calling each other.
import { createTracker, type Reading } from '../core/tracker/tracker.ts';
import { createDecoder, type Decoded } from '../core/packet/codec.ts';
import { deriveKeys, publicKeys, type KeySet } from '../core/packet/keys.ts';
import { decimator, openMic } from '../audio/mic.ts';
import { createModem } from '../audio/modem.ts';
import { createRelay } from '../core/relay/relay.ts';

/** Per-device conveniences only; the page works without storage (private window). */
export const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => {
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* not persisted */ }
  },
};

export const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export interface Heard { decoded: Decoded; bytes: Uint8Array; at: number }

type Events = { reading: Reading; packet: Heard; family: KeySet | null; listening: boolean; relayed: Uint8Array };

class App extends EventTarget {
  family: KeySet | null = null;
  familyWords: string | null = null;
  member = Number(store.get('stratum.member') ?? (store.set('stratum.member', String(random(1)[0])), store.get('stratum.member') ?? random(1)[0]));
  listening = false;
  lastReading: Reading | null = null;
  private ctx: AudioContext | null = null;
  private modem: Promise<Awaited<ReturnType<typeof createModem>>> | null = null; // shared, so a second caller waits for the first load
  private decode: ReturnType<typeof createDecoder> | null = null;
  private quietUntil = 0; // tracker readings are ignored while this phone transmits
  /** Pass on packets heard for others (problems 7 and 8); the Listen screen toggles it. */
  relaying = store.get('stratum.relay') !== 'off';
  private relay = createRelay(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
  private pending = new Map<string, ReturnType<typeof setTimeout>>();

  on<K extends keyof Events>(type: K, fn: (v: Events[K]) => void) {
    this.addEventListener(type, (e) => fn((e as CustomEvent<Events[K]>).detail));
  }
  private emit<K extends keyof Events>(type: K, detail: Events[K]) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /** Joins a family by its six words; returns an error message, or null on success. */
  async join(words: string): Promise<string | null> {
    const k = await deriveKeys(words, 'family');
    if ('error' in k) return k.error === 'word-count' ? 'Type exactly six words.' : `"${k.word}" is not one of the family words. Check the spelling.`;
    this.family = k;
    this.familyWords = words.normalize('NFKD').toLowerCase().trim().split(/\s+/).join(' ');
    this.decode = null; // rebuilt with the new key set
    store.set('stratum.words', this.familyWords);
    this.emit('family', k);
    return null;
  }

  leave() {
    store.set('stratum.words', null);
    this.family = null;
    this.familyWords = null;
    this.decode = null;
    this.emit('family', null);
  }

  /** Must first be called from a tap: browsers allow sound only after a user gesture. */
  async audio() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.modem = createModem(this.ctx.sampleRate);
    }
    const modem = await this.modem!;
    await this.ctx.resume();
    return { ctx: this.ctx, modem };
  }

  /** Opens the microphone once; feeds the tracker (8 kHz copy) and the packet decoder. Returns the mic settings. */
  async listen() {
    const { ctx, modem } = await this.audio();
    const dec = decimator(ctx.sampleRate);
    const tracker = createTracker({ sampleRate: dec.rate, label: 'LIVE' });
    const s = await openMic(ctx, (x) => {
      const rs = tracker.push(dec.push(x));
      if (rs.length && performance.now() > this.quietUntil) {
        this.lastReading = rs[rs.length - 1];
        this.emit('reading', this.lastReading);
      }
      for (const bytes of modem.receive(x)) void this.receive(bytes);
    });
    this.listening = true;
    this.emit('listening', true);
    return s;
  }

  private async receive(bytes: Uint8Array) {
    this.decode ??= createDecoder(this.family ? [this.family] : [], await publicKeys());
    const now = Date.now();
    const r = await this.decode(bytes, now);
    // Every hearing is counted, even with relaying off; no reading yet does not vouch for a grid alert.
    const a = this.relay.hear(bytes, r, this.lastReading ?? { state: 'CALIBRATING' }, now);
    if (a && 'cancel' in a) {
      clearTimeout(this.pending.get(a.cancel));
      this.pending.delete(a.cancel);
    } else if (a && this.relaying) {
      this.pending.set(a.id, setTimeout(() => {
        this.pending.delete(a.id);
        // Sound blocked (audio interrupted): this copy is not passed on and the count stays put; other phones still carry it.
        if (this.relaying) this.send(a.send).then(() => this.emit('relayed', a.send), () => {});
      }, a.atMs - Date.now()));
    }
    if ('reject' in r) return; // not for us, damaged or replayed: say nothing
    this.emit('packet', { decoded: r, bytes, at: Date.now() });
  }

  /** Plays packet bytes as sound; resolves when playback ends. */
  async send(bytes: Uint8Array) {
    this.relay.own(bytes); // its echo is never relayed back
    const { ctx, modem } = await this.audio();
    const x = modem.encode(bytes);
    const buf = ctx.createBuffer(1, x.length, ctx.sampleRate);
    buf.getChannelData(0).set(x);
    const src = new AudioBufferSourceNode(ctx, { buffer: buf });
    src.connect(ctx.destination);
    this.quietUntil = performance.now() + buf.duration * 1000 + 2500; // our own chirp is loud: skip readings
    await new Promise((r) => { src.onended = r; src.start(); });
  }

  /** A fresh 24-bit nonce from a secure source (packet design: never reuse within a minute). */
  nonce() {
    const n = random(3);
    return (n[0] << 16) | (n[1] << 8) | n[2];
  }
}

export const app = new App();

/** Time of day for a Unix minute, as the reader's clock shows it. */
export const clock = (minute: number) => new Date(minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
