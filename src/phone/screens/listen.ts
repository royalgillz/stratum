import type { Reading } from '../../core/tracker/tracker.ts';
import { $, app, store } from '../app.ts';
import { CALIBRATING_TEXT, devText, REPLAY_DETAILS, REPLAY_TEXT, TIER_TEXT } from '../tiers.ts';

/** Writes only on change: #tier is a live region, and rewriting the same text makes screen readers say it again. */
const put = (el: HTMLElement, s: string) => { if (el.textContent !== s) el.textContent = s; };

/** The browser's microphone error, in plain words with a next step. */
function micError(e: unknown) {
  if (!navigator.mediaDevices) return 'This page must be opened over https to use the microphone.';
  if ((e as Error).name === 'ReloadError') return (e as Error).message;
  if ((e as Error).name === 'NotAllowedError') return 'Microphone permission was refused. Allow the microphone for this page in the browser settings, then tap Start listening again.';
  return 'The microphone could not be opened. Close other apps using it and try again.';
}

export function mountListen(root: HTMLElement) {
  root.innerHTML = `
    <h2>Listen to the grid</h2>
    <p class="muted">Uses the microphone on this phone only. Nothing is recorded or uploaded. Keep the phone within about 30 cm of the hum.</p>
    <button id="listenBtn">Start listening</button>
    <p id="tier" class="idle" role="status" aria-live="polite">Not listening yet</p>
    <p id="dev"></p>
    <p id="replay" class="muted">${REPLAY_TEXT}</p>
    <details id="replayMore"><summary>How sure is this?</summary><p class="muted">${REPLAY_DETAILS}</p></details>
    <p id="micinfo" class="muted"></p>
    <label class="check"><input type="checkbox" id="relayOn" /> Pass on messages for others</label>
    <p id="relayCount" role="status" aria-live="polite">Relaying starts when you tap Start listening.</p>
    <p class="muted">With no network, phones carry each other's messages a few metres at a time; this phone never decodes other families' messages, it only repeats them.</p>`;
  const btn = $<HTMLButtonElement>('#listenBtn', root);

  const relayOn = $<HTMLInputElement>('#relayOn', root);
  relayOn.checked = app.relaying;
  relayOn.onchange = () => {
    app.relaying = relayOn.checked;
    store.set('stratum.relay', relayOn.checked ? null : 'off');
  };
  let relayed = 0;
  // Relaying runs only while the microphone is open, so the count appears only from then on.
  const showRelayed = () => ($('#relayCount', root).textContent = `Passed on ${relayed} message${relayed === 1 ? '' : 's'} this session · LIVE`);
  app.on('listening', showRelayed);
  app.on('relayed', () => { relayed++; showRelayed(); });

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
      $('#tier', root).className = 'idle';
      $('#tier', root).textContent = `Not listening. ${micError(e)}`;
      $('#dev', root).textContent = '';
    }
  };

  app.on('reading', (r: Reading) => {
    const tier = $('#tier', root), dev = $('#dev', root);
    if (tier.className !== (r.tier ?? '')) tier.className = r.tier ?? '';
    if (r.state === 'NO_HUM') {
      put(tier, 'NO HUM');
      put(dev, 'No grid sound heard. Move closer to a powered wall or machine.');
    } else if (r.state === 'CALIBRATING') {
      put(tier, 'Calibrating…');
      put(dev, `${CALIBRATING_TEXT} Keep the phone still.`);
    } else if (r.tier) {
      put(tier, TIER_TEXT[r.tier]);
      put(dev, devText(r.deviationMHz!, r.label));
    }
  });
}
