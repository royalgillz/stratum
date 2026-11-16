import { encode, TYPES } from '../../core/packet/codec.ts';
import { $, app, store } from '../app.ts';

export function mountReport(root: HTMLElement) {
  root.innerHTML = `
    <h2>Report</h2>
    <p class="muted">Tell your family and neighbours what is happening here, by sound.</p>
    <div class="row">
      <label>Level <select id="level"></select></label>
      <label>Sector <select id="sector"></select></label>
    </div>
    <label class="check"><input type="checkbox" id="power" checked /> Power on here</label>
    <div><button id="sendOk">Send OK to family</button></div>
    <p id="sent" class="muted" role="status"></p>`;

  const level = $<HTMLSelectElement>('#level', root), sector = $<HTMLSelectElement>('#sector', root);
  for (let l = 1; l <= 6; l++) level.append(new Option(String(l), String(l)));
  for (let s = 0; s < 4; s++) sector.append(new Option(String.fromCharCode(65 + s), String(s)));
  level.value = store.get('stratum.level') ?? '5';
  sector.value = store.get('stratum.sector') ?? '0';
  level.onchange = () => store.set('stratum.level', level.value);
  sector.onchange = () => store.set('stratum.sector', sector.value);

  const btn = $<HTMLButtonElement>('#sendOk', root), sent = $('#sent', root);
  btn.onclick = async () => {
    if (!app.family) {
      sent.textContent = 'Create or join a family first (Family tab).';
      return;
    }
    btn.disabled = true;
    try {
      const bytes = await encode(app.family, {
        type: TYPES.OK,
        minute: Math.floor(Date.now() / 60000),
        nonce: app.nonce(),
        hops: 3,
        payload: {
          member: app.member, code: 0, level: Number(level.value), sector: Number(sector.value),
          flags: $<HTMLInputElement>('#power', root).checked ? 1 : 0, value: 0,
        },
      });
      sent.textContent = 'Sending… keep the phone still.';
      await app.send(bytes);
      sent.textContent = `OK sent at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    } finally {
      btn.disabled = false;
    }
  };
}
