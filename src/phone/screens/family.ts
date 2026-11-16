import { TYPES } from '../../core/packet/codec.ts';
import { generateWords } from '../../core/packet/keys.ts';
import { $, app, clock, random, type Heard } from '../app.ts';

const TYPE_NAME: Record<number, string> = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));

export function mountFamily(root: HTMLElement) {
  root.innerHTML = `
    <h2>Family</h2>
    <div id="family"></div>
    <h2>Inbox</h2>
    <p class="muted">Times shown are when each message was sent, not when it arrived. Messages arrive only while the Listen tab is on.</p>
    <ul id="inbox" class="list"></ul>`;
  const box = $('#family', root);

  function render(error = '') {
    if (app.family && app.familyWords) {
      box.innerHTML = `<p>Family words (type these on every family phone):</p><p class="words"></p>
        <button id="leave">Leave family</button>`;
      $('.words', box).textContent = app.familyWords;
      $<HTMLButtonElement>('#leave', box).onclick = () => {
        if (confirm('Leave this family? You will need the six words to rejoin.')) app.leave();
      };
      return;
    }
    box.innerHTML = `<button id="create">Create a family</button>
      <p class="muted">Or join one: type the six words from a family phone.</p>
      <input type="text" id="words" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Six family words" />
      <button id="join">Join family</button><p class="err" role="alert"></p>`;
    $('.err', box).textContent = error;
    $<HTMLButtonElement>('#create', box).onclick = () => void join(generateWords(random(9)).join(' '));
    $<HTMLButtonElement>('#join', box).onclick = () => void join($<HTMLInputElement>('#words', box).value);
  }

  async function join(words: string) {
    const err = await app.join(words);
    if (err) render(err);
  }

  app.on('family', () => render());
  app.on('packet', ({ decoded: r }: Heard) => {
    const p = r.payload;
    const where = `level ${p.level}, sector ${String.fromCharCode(65 + p.sector)}`;
    const li = document.createElement('li');
    li.textContent = `${clock(r.minute)} · ${TYPE_NAME[r.type] ?? r.type} from member ${p.member} · ${where} · power ${p.flags & 1 ? 'on' : 'off'}`
      + (r.public ? ' · public' : '') + (r.duplicate ? ` · heard ${r.timesHeard}×` : '');
    $('#inbox', root).prepend(li);
  });
  render();
}
