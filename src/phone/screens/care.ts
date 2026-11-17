// Breath Count (problem 10): a decision aid, not a medical device. All classification is in
// src/core/care/breath.ts; this screen only collects the inputs and shows the result.
import { classify, DISCLAIMER, needRequest, type BreathResult, type DangerSigns } from '../../core/care/breath.ts';
import { encode, TYPES } from '../../core/packet/codec.ts';
import { $, app } from '../app.ts';

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
  REFER_YOUNG: '✚ REFER: see a health worker',
  NOT_ASSESSED: '○ NOT ASSESSED',
  null: '✕ NOT FOR THIS CHILD',
};

const MINUTE = 60000;
const SHORT = 'Decision aid, not a medical device. If you are worried, take the child to a health worker.';

export function mountCare(root: HTMLElement) {
  const cut = DISCLAIMER.indexOf('. ') + 1; // only the first sentence is bold, so the age picker stays near the top
  root.innerHTML = `
    <h2>Breath Count</h2>
    <p id="disclaimer" class="disclaimer" role="note"><strong>⚠ ${DISCLAIMER.slice(0, cut)}</strong>${DISCLAIMER.slice(cut)}</p>
    <fieldset>
      <legend>1. Child's age</legend>
      <div class="row">
        <label>Years <select id="years"><option value="">Choose</option>
          ${[0, 1, 2, 3, 4].map((y) => `<option>${y}</option>`).join('')}<option value="5">5 or older</option></select></label>
        <label>Months <select id="months"><option value="">Choose</option>${Array.from({ length: 12 }, (_, m) => `<option>${m}</option>`).join('')}</select></label>
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
      <div id="step4">
        <h3>4. Count breaths for one minute</h3>
        <p class="muted">Watch the chest or belly while the child is calm. Tap the big button once each time the chest rises.</p>
        <button id="start" disabled aria-describedby="startWhy">Start 60-second count</button>
        <p id="startWhy" class="muted">Answer question 2 first. Breaths are counted only for cough or difficult breathing.</p>
      </div>
      <div id="counter" hidden>
        <p class="count"><span id="left">60 s left</span> · <span id="taps">0 breaths</span> · LIVE</p>
        <button id="tap" class="tap">Tap once per breath</button>
        <button id="stop">Stop</button>
        <p class="muted">${SHORT}</p>
      </div>
    </div>
    <p id="announce" class="sr-only" role="status" aria-live="polite"></p>
    <div id="result" class="result" tabindex="-1" hidden></div>
    <div id="need" hidden>
      <p id="careWhere"></p>
      <button id="request">Request medicine</button>
      <p id="careSent" role="status"></p>
      <button id="careFamily" hidden>Go to Family tab</button>
    </div>`;

  const years = $<HTMLSelectElement>('#years', root), months = $<HTMLSelectElement>('#months', root);
  const start = $<HTMLButtonElement>('#start', root), announce = $('#announce', root);
  // Months matter only under one year (thresholds change at 2 and 12 months), so only then must they be chosen.
  const ageMonths = () => (years.value === '' || (years.value === '0' && months.value === '') ? null : Number(years.value) * 12 + Number(months.value));
  const cough = () => root.querySelector<HTMLInputElement>('input[name=cough]:checked')?.value;
  const signs = () => Object.fromEntries(SIGNS.map(([k]) => [k, $<HTMLInputElement>(`[data-sign=${k}]`, root).checked])) as unknown as DangerSigns;
  const counter = $('#counter', root);
  let result: BreathResult | null = null;
  let count: { tapsMs: number[]; elapsedMs: number } | null = null; // the last finished count, null while counting
  let stopCount = () => {}; // ends a running count and discards its taps
  let quiet = false; // finish() moves focus to the card, which reads it: the live region stays silent
  // The place chosen on the Report tab; none chosen sends nothing (a guessed level would be a false location).
  const lv = () => app.place.level, sc = () => app.place.sector;
  const where = () => `level ${lv()}, sector ${String.fromCharCode(65 + Number(sc()))}`;
  const NO_PLACE = 'Choose your level and sector on the Report tab first.';
  const showWhere = () => ($('#careWhere', root).textContent = lv() && sc() ? `Sends for ${where()} (change on the Report tab).` : NO_PLACE);
  new MutationObserver(showWhere).observe(root, { attributeFilter: ['hidden'] }); // back from the Report tab

  function show(r: BreathResult) {
    const box = $('#result', root);
    // A ticked danger sign turns the card RED below the fold: bring it into view once.
    if (r.classification === 'RED' && result?.classification !== 'RED') requestAnimationFrame(() => box.scrollIntoView({ block: 'nearest' }));
    result = r;
    box.className = `result ${r.classification ?? ''}`;
    const rate = r.rate === null ? 'Rate: no full minute counted yet' : `Rate: ${r.rate} breaths per minute`;
    box.innerHTML = `<p class="head"></p><p class="card"></p><p class="rate"></p>`; // the disclaimer above stays on screen
    $('.head', box).textContent = HEAD[String(r.classification)];
    $('.card', box).textContent = r.card;
    $('.rate', box).textContent = r.threshold === null || r.classification === 'NOT_ASSESSED' ? '' :
      `${rate} (fast is ${r.threshold} or more at this age) · ${r.label}${r.ignoredTaps ? ` · ${r.ignoredTaps} double taps ignored` : ''}`;
    box.hidden = false;
    $('#need', root).hidden = !needRequest(r);
    showWhere();
    $('#careSent', root).textContent = $('#careSent', root).className = '';
    $('#careFamily', root).hidden = true;
    if (!quiet) announce.textContent = `${HEAD[String(r.classification)]}. ${r.card}`;
  }

  // The card shows as soon as the core can answer without a count: an age out of range, a danger sign
  // (RED) or no cough (NOT ASSESSED). Otherwise it waits for a count. Inputs changed later re-classify.
  const update = () => {
    const age = ageMonths(), s = signs();
    const inRange = age !== null && age >= 2 && age < 60;
    if (!counter.hidden && (!inRange || cough() !== 'yes')) stopCount(); // the count no longer applies
    $('#steps', root).hidden = !inRange;
    months.closest('label')!.hidden = years.value === '5'; // months change nothing at five or older
    months.options[0].text = years.value === '' || years.value === '0' ? 'Choose' : 'Optional';
    // With no cough the card says NOT ASSESSED: no count step. Unanswered: say why Start is greyed.
    $('#step4', root).hidden = cough() === 'no';
    $('#startWhy', root).hidden = cough() === 'yes';
    start.disabled = !inRange || cough() !== 'yes' || !counter.hidden;
    if (age === null || (inRange && !count && cough() !== 'no' && !Object.values(s).some(Boolean))) {
      $('#result', root).hidden = true; $('#need', root).hidden = true; result = null;
      return;
    }
    show(classify({ ageMonths: age, cough: cough() === 'yes', tapsMs: count?.tapsMs ?? [], elapsedMs: count?.elapsedMs ?? 0, signs: s, label: 'LIVE' }));
  };
  root.addEventListener('change', update);

  start.onclick = () => {
    const taps: number[] = [], t0 = performance.now();
    let said = 60;
    const tap = $<HTMLButtonElement>('#tap', root);
    count = null;
    counter.hidden = false;
    start.hidden = true; // a greyed Start above the tap target reads like a second control
    update(); // hides an old card; a danger sign keeps RED on screen

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
    stopCount = () => {
      clearInterval(timer);
      counter.hidden = true;
      start.hidden = false;
    };
    const finish = () => {
      stopCount();
      count = { tapsMs: taps, elapsedMs: performance.now() - t0 };
      start.textContent = 'Count again';
      quiet = true;
      update();
      quiet = false;
      // The focused tap button is now hidden: move focus to the result, or back to Start.
      const box = $('#result', root);
      (box.hidden ? start : box).focus();
    };
    tap.onclick = () => {
      taps.push(performance.now() - t0);
      $('#taps', root).textContent = `${taps.length} breath${taps.length === 1 ? '' : 's'}`;
    };
    $<HTMLButtonElement>('#stop', root).onclick = finish;
    const timer = setInterval(tick, 200);
    tick();
  };

  $<HTMLButtonElement>('#careFamily', root).onclick = () => (location.hash = 'family'); // phone.ts switches tabs on hashchange
  $<HTMLButtonElement>('#request', root).onclick = async (e) => {
    const btn = e.currentTarget as HTMLButtonElement, sent = $('#careSent', root), need = result && needRequest(result);
    if (!need) return;
    if (!app.family) {
      sent.className = 'err';
      $('#careFamily', root).hidden = false;
      sent.textContent = 'Join a family first (Family tab). Without a family key the request cannot be sent privately: anyone nearby could hear which level has a sick child.';
      return;
    }
    if (!lv() || !sc()) {
      sent.className = 'err';
      sent.textContent = NO_PLACE;
      return;
    }
    app.audio().catch(() => {}); // start sound inside the tap: iOS Safari allows it only there; app.send reports a failure
    btn.disabled = true;
    sent.className = '';
    try {
      const bytes = await encode(app.family, {
        type: TYPES.NEED, minute: Math.floor(Date.now() / MINUTE), nonce: app.nonce(), hops: 3,
        payload: {
          member: app.member, code: need.code, value: need.value, flags: 0,
          level: Number(lv()), sector: Number(sc()),
        },
      });
      sent.textContent = `Sending to your family for ${where()}… keep the phone still.`;
      await app.send(bytes);
      sent.textContent = `Medicine request sent to your family at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    } catch (err) {
      console.error(err);
      sent.className = 'err';
      sent.textContent = 'Not sent: sound could not play on this phone. Tap Request medicine again, or tell your family in person.';
    } finally {
      btn.disabled = false;
      // Disabling the button dropped keyboard focus to the page; put it back.
      if (document.activeElement === document.body) btn.focus();
    }
  };
}
