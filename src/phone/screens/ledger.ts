// Ledger tab: each level's odds of being cut at AMBER and RED (problems 1 and 2), from the tiers this
// phone hears and neighbours' power reports. Core: src/core/shed (docs/intent/shed/shed-design.md).
import { createShedLedger, type CutOdds, type StressTier } from '../../core/shed/shed.ts';
import { $, app } from '../app.ts';

const TIERS: StressTier[] = ['AMBER', 'RED'];
const HEAD = { AMBER: '▲ AMBER', RED: '■ RED' } as const;

/** One odds cell: percentage, then its evidence on a second line; "no data yet" (never 50%) with no observed event. */
export function oddsText({ p, cuts, events }: CutOdds) {
  if (events === 0) return 'no data yet';
  return `${Math.round(p * 100)}%\n${cuts} ${cuts === 1 ? 'cut' : 'cuts'} in ${events} observed ${events === 1 ? 'event' : 'events'}`;
}

export function mountLedger(root: HTMLElement) {
  root.innerHTML = `
    <h2>Shed Ledger</h2>
    <p class="muted">Each number is the chance a level lost power in past stress events at that tier, from
      neighbours' reports: a level counts as cut when 3 different phones report it without power during the
      event or the 10 minutes after. It cannot say who sent a report: anyone can send public reports, and one
      person can pose as three. A level already dark before the event counts too. A level with fewer than 3
      phones reporting has no data yet. The event happening now counts once it is over.</p>
    <div id="ledger"></div>
    <p class="muted">Kept in this page's memory only: the ledger resets when the page reloads.</p>`;

  // One ledger for the page's life (the design keeps no storage).
  const ledger = createShedLedger({ label: 'LIVE' });
  const out = $('#ledger', root);
  let now = 0, family = 0, pub = 0, shown = '';
  const tick = () => (now = Math.max(now, Date.now())); // the ledger refuses time going backwards

  function render() {
    tick();
    const cur = app.lastReading?.tier;
    const cls = (t: StressTier) => (t === cur ? ' class="now"' : '');
    const html = !app.listening
      ? `<p id="ledger-empty">Not listening. Start listening on the Listen tab: this phone then records the
          stress events it hears and the power reports neighbours send.</p>`
      : `<table class="ledger">
          <caption>Odds of being cut, by level (${ledger.odds(1, 'AMBER', now).label})</caption>
          <thead><tr><th scope="col">Level</th>${TIERS.map((t) => `<th scope="col"${cls(t)}>${HEAD[t]}${t === cur ? ' (now)' : ''}</th>`).join('')}</tr></thead>
          <tbody>${[1, 2, 3, 4, 5, 6].map((l) => `<tr><th scope="row">${l}</th>${TIERS.map((t) =>
            `<td${cls(t)}>${oddsText(ledger.odds(l, t, now))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <p class="muted">Reports heard (LIVE): ${family} from your family, ${pub} public.</p>`;
    if (html !== shown) out.innerHTML = shown = html;
  }

  app.on('reading', (r) => {
    if (r.tier) ledger.tier(tick(), r.tier, r.label); // NO HUM and calibrating carry no tier: the ledger keeps the last one
    render();
  });
  app.on('packet', ({ decoded }) => {
    if (ledger.report(decoded)) decoded.public ? pub++ : family++;
    render();
  });
  app.on('listening', render);
  render();
}
