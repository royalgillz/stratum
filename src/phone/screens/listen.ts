import type { FanReading } from '../../core/air/fan.ts';
import type { Reading } from '../../core/tracker/tracker.ts';
import { $, app, store } from '../app.ts';
import { shared } from './ledger.ts';
import { CALIBRATING_TEXT, devText, REPLAY_DETAILS, REPLAY_SUMMARY, REPLAY_TEXT, TIER_TEXT } from '../tiers.ts';

/** Writes only on change: #tier is a live region, and rewriting the same text makes screen readers say it again. */
const put = (el: HTMLElement, s: string) => { if (el.textContent !== s) el.textContent = s; };

// The air line: a prompt to check, not a diagnosis (docs/intent/air/fan-design.md).
const FAN_TEXT = {
  LISTENING: 'Fan: listening for a steady fan',
  RUNNING: 'Fan: running',
  STOPPED: 'FAN STOPPED: the air may stop moving. Check the fan and the vents, and move to moving air if you feel unwell.',
} as const;
const FAN_LOG_MAX = 36000; // one hour at 10 readings a second

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
    <p class="muted">Listens for the Hollow's 400 Hz grid hum. To try it, play judge mode (linked above) with Sound on, on a laptop or a second phone, and hold this phone about 30 cm from its speaker. Uses the microphone on this phone only. Nothing is recorded or uploaded.</p>
    <button id="listenBtn">Start listening</button>
    <p id="tier" class="idle" role="status" aria-live="polite">Not listening yet</p>
    <p id="dev"></p>
    <p id="odds" hidden></p>
    <p id="fan" role="status" aria-live="polite"></p>
    <p id="replay" class="muted">${REPLAY_SUMMARY}</p>
    <details id="replayMore"><summary>How sure is this?</summary><p class="muted">${REPLAY_TEXT}</p><p class="muted">${REPLAY_DETAILS}</p></details>
    <p id="micinfo" class="muted"></p>
    <details id="fanMore"><summary>Fan test log (for testers)</summary>
      <p class="muted">For testing the fan alert: saves this session's fan readings (time, level, state) as a CSV file. Nothing is uploaded.</p>
      <button id="fanSave">Save fan log</button>
    </details>
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

  const fanLog: string[] = [];
  app.on('fan', (r: FanReading | null) => {
    const fan = $('#fan', root);
    if (!r) {
      fan.className = '';
      put(fan, 'Fan: no sound from the microphone. Check that it is not muted or in use by a call. · LIVE');
      return;
    }
    if (r.state === 'STOPPED' && fan.className !== 'STOPPED') navigator.vibrate?.(200);
    if (fan.className !== r.state) fan.className = r.state;
    put(fan, `${FAN_TEXT[r.state]} · ${r.label}`);
    fanLog.push([new Date().toISOString(), r.t.toFixed(2), r.levelDb.toFixed(1), r.baselineDb.toFixed(1), r.floorDb.toFixed(1), r.runningDb?.toFixed(1) ?? '', r.steady, r.state].join(','));
    if (fanLog.length > FAN_LOG_MAX) fanLog.shift();
  });
  $('#fanSave', root).onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([['time,t_s,level_db,baseline_db,floor_db,running_db,steady,state', ...fanLog].join('\n')], { type: 'text/csv' }));
    a.download = `stratum-fan-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
  };

  app.on('reading', (r: Reading) => {
    const tier = $('#tier', root), dev = $('#dev', root), odds = $('#odds', root);
    // Under strain, this phone's level's cut odds from the Ledger tab (level chosen on the Report tab).
    const level = Number(app.place.level);
    odds.hidden = !(level && (r.tier === 'AMBER' || r.tier === 'RED'));
    if (!odds.hidden) put(odds, shared.line(level, r.tier as 'AMBER' | 'RED'));
    if (tier.className !== (r.tier ?? '')) tier.className = r.tier ?? '';
    if (r.state === 'NO_HUM') {
      put(tier, 'NO HUM');
      put(dev, 'No 400 Hz grid hum heard. A normal room reads NO HUM: play judge mode with Sound on, nearby.');
    } else if (r.state === 'CALIBRATING') {
      put(tier, 'Calibrating…');
      put(dev, `${CALIBRATING_TEXT} Keep the phone still.`);
    } else if (r.tier) {
      put(tier, TIER_TEXT[r.tier]);
      put(dev, devText(r.deviationMHz!, r.label));
    }
  });
}
