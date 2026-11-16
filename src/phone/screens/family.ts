import { TYPES, type Decoded } from '../../core/packet/codec.ts';
import { generateWords } from '../../core/packet/keys.ts';
import { $, app, clock, random, store, type Heard } from '../app.ts';

const TYPE_NAME: Record<number, string> = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));
const STALE_MIN = 30;

export interface Row { d: Decoded; ago: number; stale: boolean }

/** Latest packet per member (by the packet's own minute), newest first; repeats of a packet are ignored. */
export function boardRows(heard: Decoded[], now: number): Row[] {
  const latest = new Map<number, Decoded>();
  for (const d of heard) {
    const prev = latest.get(d.payload.member);
    if (!d.duplicate && (!prev || d.minute >= prev.minute)) latest.set(d.payload.member, d);
  }
  return [...latest.values()]
    .sort((a, b) => b.minute - a.minute || a.payload.member - b.payload.member)
    .map((d) => {
      const ago = Math.max(0, Math.floor(now / 60000) - d.minute); // a sender's clock may run ahead
      return { d, ago, stale: ago > STALE_MIN };
    });
}

const nickKey = (member: number) => `stratum.nick.${member}`;

export function mountFamily(root: HTMLElement) {
  root.innerHTML = `
    <h2>Family</h2>
    <div id="family"></div>
    <h2>Family board</h2>
    <div id="board"></div>
    <h2>Inbox</h2>
    <p class="muted">Times shown are when each message was sent, not when it arrived. Messages arrive only while the Listen tab is on.</p>
    <ul id="inbox" class="list"></ul>`;
  const box = $('#family', root), board = $('#board', root);
  let heard: Decoded[] = []; // latest per member only, kept small by boardRows

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

  const el = (tag: string, text: string, cls = '') => {
    const e = document.createElement(tag);
    e.textContent = text;
    e.className = cls;
    return e;
  };

  function renderBoard() {
    const rows = boardRows(heard, Date.now());
    heard = rows.map((r) => r.d);
    board.replaceChildren(el('p', `You are member ${app.member}.`));
    if (!rows.length) {
      board.append(el('p', 'Nothing heard from your family yet. Messages arrive only while the Listen tab is on: open it, tap Start listening, and keep this phone near the others.', 'muted'));
      return;
    }
    const members = new Set([app.member, ...rows.map((r) => r.d.payload.member)]);
    board.append(el('p', `${rows.filter((r) => !r.stale).length} of ${members.size} members heard in the last ${STALE_MIN} min`));
    const ul = el('ul', '', 'list board');
    for (const { d, ago, stale } of rows) {
      const p = d.payload, nick = store.get(nickKey(p.member));
      const who = `${nick ? `${nick} (member ${p.member})` : `Member ${p.member}`}${p.member === app.member ? ' (you)' : ''}`;
      const li = document.createElement('li');
      const text = el('div', '');
      text.append(
        el('strong', who),
        el('div', stale ? `⚠ Not heard for over ${STALE_MIN} min` : '✓ Heard recently', stale ? 'stale' : ''),
        el('div', `${TYPE_NAME[d.type] ?? d.type} sent ${clock(d.minute)}, ${ago} min ago · level ${p.level}, sector ${String.fromCharCode(65 + p.sector)} · power ${p.flags & 1 ? 'on' : 'off'}`, 'muted'),
      );
      const btn = el('button', 'Nickname') as HTMLButtonElement;
      btn.setAttribute('aria-label', `Nickname for member ${p.member}`);
      btn.onclick = () => {
        const name = prompt(`Nickname for member ${p.member} (kept on this phone only, never sent). Leave empty to clear.`, nick ?? '');
        if (name === null) return;
        store.set(nickKey(p.member), name.trim() || null);
        renderBoard();
      };
      li.append(text, btn);
      ul.append(li);
    }
    board.append(ul);
  }

  app.on('family', () => { heard = []; renderBoard(); render(); });
  app.on('packet', ({ decoded: r }: Heard) => {
    const p = r.payload;
    const where = `level ${p.level}, sector ${String.fromCharCode(65 + p.sector)}`;
    const li = document.createElement('li');
    li.textContent = `${clock(r.minute)} · ${TYPE_NAME[r.type] ?? r.type} from member ${p.member} · ${where} · power ${p.flags & 1 ? 'on' : 'off'}`
      + (r.public ? ' · public' : '') + (r.duplicate ? ` · heard ${r.timesHeard}×` : '');
    $('#inbox', root).prepend(li);
    if (app.family && r.keySet === app.family.id) { heard.push(r); renderBoard(); }
  });
  setInterval(renderBoard, 30_000); // ages and staleness move on without new packets
  render();
  renderBoard();
}
