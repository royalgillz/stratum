import tapUrl from './tap.worklet.js?url&no-inline';

/**
 * Opens one microphone stream with all browser processing off (project sound rule) and feeds
 * raw blocks to onBlock. One stream serves both the tracker and the packet decoder.
 */
export async function openMic(ctx: AudioContext, onBlock: (x: Float32Array) => void, analyser?: AnalyserNode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  try {
    // The worklet file is fetched only now; if it is gone (this tab runs a build that has since been replaced), only a reload helps.
    await ctx.audioWorklet.addModule(tapUrl).catch(() => { throw new DOMException('STRATUM was updated: reload the page to listen.', 'ReloadError'); });
    await ctx.resume();
    const node = new AudioWorkletNode(ctx, 'tap');
    node.port.onmessage = (e) => onBlock(e.data);
    const source = ctx.createMediaStreamSource(stream);
    source.connect(node).connect(ctx.destination); // node outputs silence
    if (analyser) source.connect(analyser); // the fan watch reads the same stream
    return stream.getAudioTracks()[0].getSettings();
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop()); // a failed open must not leave the microphone live
    throw e;
  }
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

/**
 * FFT bins of the fan band (docs/intent/air/fan-design.md): 150 to 1,700 Hz, below the packet band,
 * leaving out 4 bins each side of every multiple of 400 Hz so the in-world hum is not counted as fan.
 * The analyser's Blackman window spreads a tone over about ±3 bins, so a narrower notch lets the hum in.
 */
export function fanBins(sampleRate: number, fftSize: number): number[] {
  const hz = sampleRate / fftSize, bins: number[] = [];
  for (let k = Math.ceil(150 / hz); k * hz <= 1700; k++) if (Math.abs(k * hz - 400 * Math.round((k * hz) / 400)) > 4 * hz) bins.push(k);
  return bins;
}

/** Total power of those bins in dB, from an analyser's dB-per-bin spectrum; -Infinity on digital silence. */
export const bandDb = (spectrum: Float32Array, bins: number[]) => 10 * Math.log10(bins.reduce((sum, k) => sum + 10 ** (spectrum[k] / 10), 0));
