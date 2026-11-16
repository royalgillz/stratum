// ggwave 0.4.0 adapter: bytes to sound and back. The library loads as a classic script
// (public/vendor/ggwave/ggwave.js) that defines the global ggwave_factory.

declare const ggwave_factory: () => Promise<any>;

const FRAME = 1024; // ggwave's samplesPerFrame
const VOLUME = 50;

export async function createModem(sampleRate: number) {
  const g = await ggwave_factory();
  g.disableLog();
  const params = g.getDefaultParameters();
  params.sampleRateInp = sampleRate;
  params.sampleRateOut = sampleRate;
  const inst = g.init(params);
  const frame = new Float32Array(FRAME);
  let k = 0;

  return {
    /** Float32 samples for the bytes, copied out of wasm memory. */
    encode(bytes: Uint8Array): Float32Array {
      const w: Int8Array = g.encode(inst, bytes, g.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, VOLUME);
      return new Float32Array(w.buffer.slice(w.byteOffset, w.byteOffset + w.length));
    },
    /** Feed microphone samples of any block size; returns the bytes of each packet completed. */
    receive(x: Float32Array): Uint8Array[] {
      const got: Uint8Array[] = [];
      for (let i = 0; i < x.length; ) {
        const n = Math.min(FRAME - k, x.length - i);
        frame.set(x.subarray(i, i + n), k);
        k += n;
        i += n;
        if (k < FRAME) break;
        k = 0;
        const r: Int8Array = g.decode(inst, new Int8Array(frame.buffer));
        if (r.length) got.push(new Uint8Array(r)); // wraps -56 to 200 and copies out of wasm memory
      }
      return got;
    },
  };
}
