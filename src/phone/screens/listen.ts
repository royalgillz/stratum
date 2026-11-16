import type { Reading } from '../../core/tracker/tracker.ts';
import { $, app } from '../app.ts';

const TIER_TEXT = { GREEN: '● NORMAL', AMBER: '▲ WARNING: grid under strain', RED: '■ DANGER: cut likely soon' } as const;

export function mountListen(root: HTMLElement) {
  root.innerHTML = `
    <h2>Listen to the grid</h2>
    <p class="muted">Uses the microphone on this phone only. Nothing is recorded or sent. Keep the phone within about 30 cm of the hum.</p>
    <button id="listen">Start listening</button>
    <p id="tier" role="status" aria-live="polite">Not listening yet</p>
    <p id="dev"></p>
    <p id="micinfo" class="muted"></p>`;
  const btn = $<HTMLButtonElement>('#listen', root);

  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const s = await app.listen();
      btn.textContent = 'Listening';
      $('#micinfo', root).textContent = s.echoCancellation || s.noiseSuppression || s.autoGainControl
        ? 'Warning: this browser kept some microphone processing on; readings may be less accurate.'
        : '';
    } catch (e) {
      btn.disabled = false;
      $('#tier', root).textContent = 'Not listening';
      $('#dev', root).textContent = `Could not open the microphone: ${(e as Error).message}`;
    }
  };

  app.on('reading', (r: Reading) => {
    const tier = $('#tier', root), dev = $('#dev', root);
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
  });
}
