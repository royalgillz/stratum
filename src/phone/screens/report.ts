import { encode, TYPES } from '../../core/packet/codec.ts';
import { publicKeys } from '../../core/packet/keys.ts';
import { $, app, store } from '../app.ts';
import { CODEBOOK, type Entry, type KeyChoice } from '../codebook.ts';

const GROUPS = [['OK', 'OK'], ['NEED', 'Need'], ['REPORT', 'Report here']] as const;
const TO: Record<KeyChoice, string> = { family: 'your family', public: 'everyone nearby' };

export function mountReport(root: HTMLElement) {
  root.innerHTML = `
    <h2>Report</h2>
    <p class="muted">Tell your family and neighbours what is happening here, by sound.</p>
    <div class="row">
      <label>Level <select id="level"></select></label>
      <label>Sector <select id="sector"></select></label>
    </div>
    <label class="check"><input type="checkbox" id="power" checked /> Power on here</label>
    <fieldset id="grid">
      ${GROUPS.map(([type, name]) => `<h3>${name}</h3><div class="grid">${CODEBOOK.filter((e) => e.type === type)
        .map((e) => `<button data-code="${e.code}"><span aria-hidden="true">${e.icon}</span>${e.label}</button>`).join('')}</div>`).join('')}
    </fieldset>
    <p id="sent" role="status"></p>
    <dialog id="confirm" aria-labelledby="confirm-title">
      <form method="dialog">
        <h3 id="confirm-title"></h3>
        <p id="where"></p>
        <fieldset id="to"><legend>Send to</legend>
          <label><input type="radio" name="to" value="family" /> Family only</label>
          <label><input type="radio" name="to" value="public" /> Everyone nearby</label>
        </fieldset>
        <p id="nofamily"></p>
        <label id="countRow">How many people? (optional) <input type="number" id="count" min="1" max="65535" step="1" inputmode="numeric" /></label>
        <p class="muted">Sending plays about 3 s of sound and cannot be called back.</p>
        <div class="row"><button value="send" id="go">Send now</button><button value="cancel" formnovalidate>Cancel</button></div>
      </form>
    </dialog>`;

  const level = $<HTMLSelectElement>('#level', root), sector = $<HTMLSelectElement>('#sector', root);
  for (let l = 1; l <= 6; l++) level.append(new Option(String(l), String(l)));
  for (let s = 0; s < 4; s++) sector.append(new Option(String.fromCharCode(65 + s), String(s)));
  level.value = store.get('stratum.level') ?? '5';
  sector.value = store.get('stratum.sector') ?? '0';
  level.onchange = () => store.set('stratum.level', level.value);
  sector.onchange = () => store.set('stratum.sector', sector.value);

  const grid = $<HTMLFieldSetElement>('#grid', root), sent = $('#sent', root), dlg = $<HTMLDialogElement>('#confirm', root);
  const power = $<HTMLInputElement>('#power', root), count = $<HTMLInputElement>('#count', root);
  const radio = (k: KeyChoice) => $<HTMLInputElement>(`input[value=${k}]`, dlg);
  const powerOn = (e: Entry) => e.power ?? power.checked;
  let entry: Entry | undefined;

  grid.onclick = (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-code]');
    if (!b) return;
    const e = (entry = CODEBOOK.find((x) => x.code === Number(b.dataset.code))!);
    // Default key set: the entry's first choice that this phone can use (public always, family once joined).
    const k = e.keys.find((x) => x === 'public' || app.family);
    radio('family').disabled = !app.family || !e.keys.includes('family');
    radio('public').disabled = !e.keys.includes('public');
    if (k) radio(k).checked = true;
    $('#to', dlg).hidden = e.keys.length < 2;
    $('#confirm-title', dlg).textContent = `${e.icon} ${e.label}`;
    $('#where', dlg).textContent = `Level ${level.value}, sector ${String.fromCharCode(65 + Number(sector.value))}, power ${powerOn(e) ? 'on' : 'off'}.`;
    $('#nofamily', dlg).textContent = app.family ? '' : k
      ? 'You have no family yet, so this goes to everyone nearby. To send to your family only, create or join a family on the Family tab.'
      : 'This message goes to your family only, and you have no family yet. Create a family, or join one with its six words, on the Family tab.';
    const go = $<HTMLButtonElement>('#go', dlg);
    go.hidden = go.disabled = !k; // disabled too, so Enter cannot submit a family-only message
    $('#countRow', dlg).hidden = !e.count;
    count.value = '';
    dlg.returnValue = '';
    dlg.showModal();
  };

  dlg.onclose = () => {
    if (dlg.returnValue === 'send' && entry) void send(entry, $<HTMLInputElement>('input[name=to]:checked', dlg).value as KeyChoice);
  };

  async function send(e: Entry, to: KeyChoice) {
    const what = `"${e.label}" to ${TO[to]}`;
    grid.disabled = true; // one message on air at a time
    sent.className = '';
    try {
      const keys = to === 'public' ? await publicKeys() : app.family;
      if (!keys) throw new Error('you left the family. Join it again on the Family tab.');
      const bytes = await encode(keys, {
        type: TYPES[e.type],
        minute: Math.floor(Date.now() / 60000),
        nonce: app.nonce(),
        hops: 3,
        payload: {
          member: app.member, code: e.code, level: Number(level.value), sector: Number(sector.value),
          flags: powerOn(e) ? 1 : 0, value: e.count ? Number(count.value) : 0,
        },
      });
      sent.textContent = `⏳ Sending ${what}… keep the phone still.`;
      await app.send(bytes);
      sent.textContent = `✔ Sent ${what} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    } catch (err) {
      sent.className = 'err';
      sent.textContent = `✖ Not sent: ${(err as Error).message}`;
    } finally {
      grid.disabled = false;
    }
  }
}
