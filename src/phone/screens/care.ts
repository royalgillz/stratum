// Breath Count (problem 10): a decision aid, not a medical device. All classification is in
// src/core/care/breath.ts; this screen only collects the inputs and shows the result.
import { classify, DISCLAIMER, needRequest, type BreathResult, type DangerSigns } from '../../core/care/breath.ts';
import { encode, TYPES } from '../../core/packet/codec.ts';
import { $, app, store } from '../app.ts';

const SIGNS: [keyof DangerSigns, string][] = [
  ['chestIndrawing', 'Chest indrawing (the lower chest pulls in when the child breathes in)'],
  ['unableToDrink', 'Not able to drink or breastfeed'],
  ['vomitsEverything', 'Vomits everything'],
  ['convulsions', 'Convulsions (fits)'],
  ['sleepyOrUnconscious', 'Unusually sleepy or unconscious'],
];

const HEAD: Record<string, string> = {
  RED: '■ RED: danger',
  AMBER: '▲ AMBER: fast breathing',
  GREEN: '● GREEN: breathing not fast',
  RECOUNT: '↻ RECOUNT: count again',
  REFER_YOUNG: '✚ REFER: too young for this aid',
  NOT_ASSESSED: '○ NOT ASSESSED',
  null: '✕ NOT FOR THIS CHILD',
};

const MINUTE = 60000;

export function mountCare(root: HTMLElement) {
  root.innerHTML = `
    <h2>Breath Count</h2>
    <p id="disclaimer" class="disclaimer" role="note"><strong>⚠ ${DISCLAIMER}</strong></p>
    <fieldset>
      <legend>1. Child's age</legend>
      <div class="row">
        <label>Years <select id="years"><option value="">Choose</option>
          ${[0, 1, 2, 3, 4].map((y) => `<option>${y}</option>`).join('')}<option value="5">5 or older</option></select></label>
        <label>Months <select id="months">${Array.from({ length: 12 }, (_, m) => `<option>${m}</option>`).join('')}</select></label>
      </div>
    </fieldset>
    <div id="steps" hidden>
      <fieldset>
        <legend>2. Does the child have cough or difficult breathing?</legend>
        <label class="check"><input type="radio" name="cough" value="yes" /> Yes</label>
        <label class="check"><input type="radio" name="cough" value="no" /> No</label>
      </fieldset>
      <fieldset>
        <legend>3. Danger signs: tick any you see</legend>
        ${SIGNS.map(([k, t]) => `<label class="check"><input type="checkbox" data-sign="${k}" /> ${t}</label>`).join('')}
      </fieldset>
      <h3>4. Count breaths for one minute</h3>
      <p class="muted">Watch the chest or belly while the child is calm. Tap the big button once each time the chest rises.</p>
      <button id="start" disabled>Start 60-second count</button>
      <div id="counter" hidden>
        <p class="count"><span id="left">60 s left</span> · <span id="taps">0 breaths</span></p>
        <button id="tap" class="tap">Tap once per breath</button>
        <button id="stop">Stop</button>
      </div>
    </div>
    <p id="announce" class="sr-only" role="status" aria-live="polite"></p>
    <div id="result" class="result" hidden></div>
    <div id="need" hidden>
      <button id="request">Request medicine</button>
      <p id="sent" class="muted" role="status"></p>
    </div>`;

  const years = $<HTMLSelectElement>('#years', root), months = $<HTMLSelectElement>('#months', root);
  const start = $<HTMLButtonElement>('#start', root), announce = $('#announce', root);
  const ageMonths = () => (years.value === '' ? null : Number(years.value) * 12 + Number(months.value));
  const cough = () => root.querySelector<HTMLInputElement>('input[name=cough]:checked')?.value;
  const signs = () => Object.fromEntries(SIGNS.map(([k]) => [k, $<HTMLInputElement>(`[data-sign=${k}]`, root).checked])) as unknown as DangerSigns;
  let result: BreathResult | null = null;

  function show(r: BreathResult) {
    result = r;
    const box = $('#result', root);
    box.className = `result ${r.classification ?? ''}`;
    const rate = r.rate === null ? 'Rate: none (no full minute counted)' : `Rate: ${r.rate} breaths per minute`;
    box.innerHTML = '<p class="head"></p><p class="card"></p><p class="rate"></p>';
    $('.head', box).textContent = HEAD[String(r.classification)];
    $('.card', box).textContent = r.card;
    $('.rate', box).textContent = r.threshold === null ? '' :
      `${rate} (fast is ${r.threshold} or more at this age) ·${r.label}${r.ignoredTaps ? ` · ${r.ignoredTaps} double taps ignored` : ''}`;
    box.hidden = false;
    $('#need', root).hidden = !needRequest(r);
    $('#sent', root).textContent = '';
    announce.textContent = `${HEAD[String(r.classification)]}. ${r.card}`;
  }

  // An age outside 2 months to under 5 years needs no count: the core gives its card at once.
  const update = () => {
    const age = ageMonths();
    const inRange = age !== null && age >= 2 && age < 60;
    $('#steps', root).hidden = !inRange;
    start.disabled = !inRange || !cough() || !$('#counter', root).hidden;
    if (age !== null && !inRange) show(classify({ ageMonths: age, cough: false, tapsMs: [], elapsedMs: 0, signs: signs(), label: 'LIVE' }));
    else if (result && (result.classification === null || result.classification === 'REFER_YOUNG')) {
      $('#result', root).hidden = true; $('#need', root).hidden = true; result = null;
    }
  };
  root.addEventListener('change', update);

  start.onclick = () => {
    const taps: number[] = [], t0 = performance.now();
    let said = 60;
    const counter = $('#counter', root), tap = $<HTMLButtonElement>('#tap', root);
    $('#result', root).hidden = true; $('#need', root).hidden = true;
    counter.hidden = false; start.disabled = true;
    $('#taps', root).textContent = '0 breaths';
    announce.textContent = 'Counting for 60 seconds. Tap once per breath.';
    tap.focus();

    const tick = () => {
      const left = Math.max(0, Math.ceil((MINUTE - (performance.now() - t0)) / 1000));
      $('#left', root).textContent = `${left} s left`;
      // Screen readers hear the time every 10 s only: a per-second live region would talk over the count.
      if (left < said && left % 10 === 0 && left > 0) {
        said = left;
        announce.textContent = `${left} seconds left`;
      }
      if (left === 0) finish();
    };
    const finish = () => {
      clearInterval(timer);
      const elapsedMs = performance.now() - t0;
      counter.hidden = true;
      start.textContent = 'Count again';
      update();
      show(classify({ ageMonths: ageMonths()!, cough: cough() === 'yes', tapsMs: taps, elapsedMs, signs: signs(), label: 'LIVE' }));
    };
    tap.onclick = () => {
      taps.push(performance.now() - t0);
      $('#taps', root).textContent = `${taps.length} breath${taps.length === 1 ? '' : 's'}`;
    };
    $<HTMLButtonElement>('#stop', root).onclick = finish;
    const timer = setInterval(tick, 200);
    tick();
  };

  $<HTMLButtonElement>('#request', root).onclick = async (e) => {
    const btn = e.currentTarget as HTMLButtonElement, sent = $('#sent', root), need = result && needRequest(result);
    if (!need) return;
    if (!app.family) {
      sent.textContent = 'Join a family first (Family tab). Without a family key the request cannot be sent privately: anyone nearby could hear which level has a sick child.';
      return;
    }
    btn.disabled = true;
    try {
      const bytes = await encode(app.family, {
        type: TYPES.NEED, minute: Math.floor(Date.now() / MINUTE), nonce: app.nonce(), hops: 3,
        payload: {
          member: app.member, code: need.code, value: need.value, flags: 0,
          level: Number(store.get('stratum.level') ?? 5), sector: Number(store.get('stratum.sector') ?? 0),
        },
      });
      sent.textContent = 'Sending to your family… keep the phone still. Uses your level and sector from the Report tab.';
      await app.send(bytes);
      sent.textContent = `Medicine request sent to your family at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    } finally {
      btn.disabled = false;
    }
  };
}
