import tapUrl from './tap.worklet.js?url&no-inline';

/**
 * Opens one microphone stream with all browser processing off (project sound rule) and feeds
 * raw blocks to onBlock. One stream serves both the tracker and the packet decoder.
 */
export async function openMic(ctx: AudioContext, onBlock: (x: Float32Array) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  // The worklet file is fetched only now; if it is gone (this tab runs a build that has since been replaced), only a reload helps.
  await ctx.audioWorklet.addModule(tapUrl).catch(() => { throw new DOMException('STRATUM was updated: reload the page to listen.', 'ReloadError'); });
  await ctx.resume();
  const node = new AudioWorkletNode(ctx, 'tap');
  node.port.onmessage = (e) => onBlock(e.data);
  ctx.createMediaStreamSource(stream).connect(node).connect(ctx.destination); // node outputs silence
  return stream.getAudioTracks()[0].getSettings();
}

/**
 * Block-average decimator to about 8 kHz for the tracker: 6x less work at 48 kHz, and the
 * 800 Hz hum is far below the new Nyquist. Packet chirps (1.9–6.3 kHz) alias to 1.7–4 kHz,
 * clear of the 795–805 Hz band.
 */
export function decimator(sampleRate: number) {
  const factor = Math.max(1, Math.floor(sampleRate / 8000));
  let acc = 0, count = 0;
  return {
    rate: sampleRate / factor,
    push(x: Float32Array): Float32Array {
      const out = new Float32Array(Math.floor((count + x.length) / factor));
      let o = 0;
      for (const v of x) {
        acc += v;
        if (++count === factor) {
          out[o++] = acc / factor;
          acc = 0;
          count = 0;
        }
      }
      return out;
    },
  };
}
