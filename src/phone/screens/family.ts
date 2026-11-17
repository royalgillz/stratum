import { TYPES, type Decoded } from '../../core/packet/codec.ts';
import { NEED_CODES } from '../../core/care/breath.ts';
import { generateWords } from '../../core/packet/keys.ts';
import { $, app, clock, random, store, type Heard } from '../app.ts';
import { CODEBOOK } from '../codebook.ts';

const KIND: Record<number, string> = {
  [TYPES.OK]: 'I am OK', [TYPES.NEED]: 'Needs help', [TYPES.REPORT]: 'Report', [TYPES.CODEBOOK]: 'Codebook',
  [TYPES.GRID_ALERT]: 'Grid alert', [TYPES.HOLD_WATER]: 'Save water', [TYPES.ROUTE]: 'Route', [TYPES.LEDGER_HEAD]: 'Ledger update',
};
const STALE_MIN = 30;

/** A Breath Count request's tier line (RED or AMBER), or null for any other message. */
export function careAlert(d: Decoded) {
  if (d.type !== TYPES.NEED) return null;
  if (d.payload.code === NEED_CODES.BREATH_RED) return { tier: 'RED', text: '■ RED: medicine request (danger sign)' };
  if (d.payload.code === NEED_CODES.BREATH_AMBER) return { tier: 'AMBER', text: `▲ AMBER: medicine request, ${d.payload.value} breaths per minute` };
  return null;
}

/** A message in plain words, shared by the board and the inbox. */
export function says(d: Decoded) {
  const e = CODEBOOK.find((x) => TYPES[x.type] === d.type && x.code === d.payload.code);
  const n = e?.count ? d.payload.value : 0; // 0 = count not given
  const people = n ? ` (${n} ${n === 1 ? 'person' : 'people'})` : '';
  return careAlert(d)?.text ?? (d.type === TYPES.OK ? KIND[d.type] : e ? `${KIND[d.type]}: ${e.label}${people}` : KIND[d.type] ?? `Message type ${d.type}`);
}

/** " · power on" or off: power is a field of OK and REPORT only, so a need shows none rather than a value that is not a reading. */
export const power = (d: Decoded) => (d.type === TYPES.OK || d.type === TYPES.REPORT ? ` · power ${d.payload.flags & 1 ? 'on' : 'off'}` : '');

export interface Row { d: Decoded; ago: number; stale: boolean }

/** Latest packet per member (by the packet's own minute): members not heard lately first, then newest first; repeats of a packet are ignored. */
export function boardRows(heard: Decoded[], now: number): Row[] {
  const latest = new Map<number, Decoded>();
  for (const d of heard) {
    const prev = latest.get(d.payload.member);
    if (!d.duplicate && (!prev || d.minute >= prev.minute)) latest.set(d.payload.member, d);
  }
  return [...latest.values()]
    .map((d) => {
      const ago = Math.max(0, Math.floor(now / 60000) - d.minute); // a sender's clock may run ahead
      return { d, ago, stale: ago > STALE_MIN };
    })
    .sort((a, b) => Number(b.stale) - Number(a.stale) || b.d.minute - a.d.minute || a.d.payload.member - b.d.payload.member);
}

const nickKey = (member: number) => `stratum.nick.${member}`;

export function mountFamily(root: HTMLElement) {
  root.innerHTML = `
    <h2>Family</h2>
    <div id="familyBox"></div>
    <h2>Family board</h2>
    <div id="board"></div>
    <h2>Inbox</h2>
    <p class="muted">Times shown are when each message was sent, not when it arrived. Messages arrive only while this phone is listening (tap Start listening on the Listen tab once; it keeps listening on every tab).</p>
    <ul id="inbox" class="list" role="log" aria-live="polite"><li class="muted empty">Nothing heard yet.</li></ul>`;
  const box = $('#familyBox', root), board = $('#board', root), inbox = $('#inbox', root);
  let heard: Decoded[] = []; // latest per member only, kept small by boardRows

  function render() {
    // Create, Join and Leave rebuild this box and destroy the focused button: move focus to what replaced it.
    const had = box.contains(document.activeElement);
    if (app.family && app.familyWords) {
      box.innerHTML = `<p>Family words (type these on every family phone):</p><p class="words" tabindex="-1"></p>
        <button id="leave">Leave family</button>`;
      $('.words', box).textContent = app.familyWords;
      $<HTMLButtonElement>('#leave', box).onclick = () => {
        if (confirm('Leave this family? You will need the six words to rejoin.')) app.leave();
      };
      if (had) $('.words', box).focus();
      return;
    }
    box.innerHTML = `<button id="create">Create a family</button>
      <form id="joinForm">
        <p class="muted">Or join one: type the six words from a family phone.</p>
        <input type="text" id="words" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="go" aria-label="Six family words" />
        <button id="join">Join family</button><p class="err" role="alert"></p>
      </form>`;
    $<HTMLButtonElement>('#create', box).onclick = () => void join(generateWords(random(9)).join(' '));
    $<HTMLFormElement>('#joinForm', box).onsubmit = (ev) => {
      ev.preventDefault();
      void join($<HTMLInputElement>('#words', box).value);
    };
    if (had) $('#create', box).focus();
  }

  async function join(words: string) {
    const err = await app.join(words);
    if (!err) return;
    // Only the message changes: the typed words stay, so one typo is fixed without retyping six words.
    $('.err', box).textContent = err;
    $<HTMLInputElement>('#words', box).focus();
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
    // a rebuild must not drop keyboard or screen-reader focus from a Nickname button
    const focused = board.contains(document.activeElement) ? document.activeElement?.getAttribute('aria-label') : null;
    board.replaceChildren(el('p', `You are member ${app.member}.`));
    if (!app.family) {
      board.append(el('p', 'Create or join a family above first. Then messages from family phones appear here while this phone is listening (Start listening on the Listen tab).', 'muted'));
      return;
    }
    if (!rows.length) {
      board.append(el('p', 'Nothing heard from your family yet. Messages arrive only while this phone is listening (tap Start listening on the Listen tab once; it keeps listening on every tab). Keep this phone near the others.', 'muted'));
      return;
    }
    const others = rows.filter((r) => r.d.payload.member !== app.member);
    if (others.length) board.append(el('p', `LIVE · ${others.filter((r) => !r.stale).length} of ${others.length} other members heard in the last ${STALE_MIN} min`));
    const ul = el('ul', '', 'list board');
    for (const { d, ago, stale } of rows) {
      const p = d.payload, nick = store.get(nickKey(p.member)), you = p.member === app.member;
      const who = `${nick ? `${nick} (member ${p.member})` : `Member ${p.member}`}${you ? ' (you)' : ''}`;
      const alert = careAlert(d);
      const li = document.createElement('li');
      const text = el('div', '');
      text.append(
        el('strong', who),
        ...(alert ? [el('div', alert.text, `alert ${alert.tier}`)] : []),
        // an old danger request must not look current: stale shows beside it
        ...(stale || !alert ? [el('div', stale ? `⚠ Not heard for over ${STALE_MIN} min` : '✓ Heard recently', stale ? 'stale' : '')] : []),
        el('div', `LIVE · ${alert ? KIND[d.type] : says(d)}, sent ${clock(d.minute)}, ${ago === 0 ? 'just now' : `${ago} min ago`} · level ${p.level}, sector ${String.fromCharCode(65 + p.sector)}${power(d)}`, 'muted'),
      );
      li.append(text);
      if (!you) {
        const btn = el('button', 'Nickname') as HTMLButtonElement;
        btn.setAttribute('aria-label', `Nickname for member ${p.member}`);
        btn.onclick = () => {
          const name = prompt(`Nickname for member ${p.member} (kept on this phone only, never sent). Leave empty to clear.`, nick ?? '');
          if (name === null) return;
          store.set(nickKey(p.member), name.trim() || null);
          renderBoard();
        };
        li.append(btn);
      }
      ul.append(li);
    }
    board.append(ul);
    if (focused) board.querySelector<HTMLElement>(`[aria-label="${focused}"]`)?.focus();
  }

  app.on('family', () => { heard = []; renderBoard(); render(); });
  app.on('packet', ({ decoded: r }: Heard) => {
    const p = r.payload, nick = store.get(nickKey(p.member));
    const from = p.member === app.member ? 'you' : nick ? `${nick} (member ${p.member})` : `member ${p.member}`;
    const text = `LIVE · ${clock(r.minute)} · ${says(r)} from ${from} · level ${p.level}, sector ${String.fromCharCode(65 + p.sector)}${power(r)}`
      + (r.public ? ' · public' : '') + (r.duplicate ? ` · heard ${r.timesHeard}×` : '');
    // A repeat (relayed copy) updates its row instead of adding a second one.
    const key = `${r.keySet}:${r.minute}:${r.type}:${p.member}:${p.code}`;
    const old = r.duplicate ? [...inbox.children].find((li) => (li as HTMLElement).dataset.key === key) : undefined;
    inbox.querySelector('.empty')?.remove();
    if (old) old.textContent = text;
    else {
      const li = el('li', text);
      li.dataset.key = key;
      inbox.prepend(li);
    }
    if (app.family && r.keySet === app.family.id) { heard.push(r); renderBoard(); }
  });
  setInterval(renderBoard, 30_000); // ages and staleness move on without new packets
  render();
  renderBoard();
}
