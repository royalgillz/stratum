import tapUrl from './tap.worklet.js?url&no-inline';

// One microphone stream with all browser processing off, fed block by block to onBlock.
export async function openMic(ctx: AudioContext, onBlock: (x: Float32Array) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  await ctx.audioWorklet.addModule(tapUrl);
  await ctx.resume();
  const node = new AudioWorkletNode(ctx, 'tap');
  node.port.onmessage = (e) => onBlock(e.data);
  ctx.createMediaStreamSource(stream).connect(node).connect(ctx.destination); // node outputs silence
  const s = stream.getAudioTracks()[0].getSettings();
  return `sampleRate ${ctx.sampleRate} | echoCancellation ${s.echoCancellation} | noiseSuppression ${s.noiseSuppression} | autoGainControl ${s.autoGainControl}`;
}
