// Ledger tab: each level's odds of being cut at AMBER and RED (problems 1 and 2), from the tiers this
// phone hears and neighbours' power reports. Core: src/core/shed (docs/intent/shed/shed-design.md).
import type { Tier } from '../../core/contracts.ts';
import type { Decoded } from '../../core/packet/codec.ts';
import { createShedLedger, type CutOdds, type StressTier } from '../../core/shed/shed.ts';
import type { Reading } from '../../core/tracker/tracker.ts';
import { $, app } from '../app.ts';

const TIERS: StressTier[] = ['AMBER', 'RED'];
const HEAD = { AMBER: '▲ AMBER', RED: '■ RED' } as const;

/** One odds cell (HTML): bold percentage, then its evidence on a second line; a muted "no data yet" (never 50%) with no observed event. */
export function oddsCell({ p, cuts, events }: CutOdds) {
  if (events === 0) return '<span class="muted">no data yet</span>';
  return `<strong>${Math.round(p * 100)}%</strong>\n${cuts} ${cuts === 1 ? 'cut' : 'cuts'} in ${events} observed ${events === 1 ? 'event' : 'events'}`;
}

/** One ledger for the page's life (the design keeps no storage), fed by readings and packets; `html` draws the table. */
export function ledgerView(clock: () => number = Date.now) {
  const ledger = createShedLedger({ label: 'LIVE' });
  let now = 0, family = 0, pub = 0;
  const tick = () => (now = Math.max(now, clock())); // the ledger refuses time going backwards
  return {
    reading(r: Reading) {
      if (r.tier) ledger.tier(tick(), r.tier, r.label); // NO HUM and calibrating carry no tier: the ledger keeps the last one
    },
    packet(d: Decoded) {
      if (ledger.report(d)) d.public ? pub++ : family++;
    },
    /** One line for the Listen tab: the odds of `level` at tier `t`, the same figures as its table cell. */
    line(level: number, t: StressTier) {
      tick();
      const { p, cuts, events, label } = ledger.odds(level, t, now);
      if (events === 0) return `Level ${level}: no data yet (needs reports from 3 phones)`;
      return `Level ${level}: cut in ${cuts} of ${events} past ${t} ${events === 1 ? 'event' : 'events'}, odds ${Math.round(p * 100)}% · ${label}`;
    },
    /** The table, with the column of `cur` (the tier heard now) marked. */
    html(cur?: Tier) {
      tick();
      const cls = (t: StressTier) => (t === cur ? ' class="now"' : '');
      return `<table class="ledger">
          <caption>Odds of being cut, by level (${ledger.odds(1, 'AMBER', now).label})</caption>
          <thead><tr><th scope="col">Level</th>${TIERS.map((t) => `<th scope="col"${cls(t)}>${HEAD[t]}${t === cur ? ' (now)' : ''}</th>`).join('')}</tr></thead>
          <tbody>${[1, 2, 3, 4, 5, 6].map((l) => `<tr><th scope="row">${l}</th>${TIERS.map((t) =>
            `<td${cls(t)}>${oddsCell(ledger.odds(l, t, now))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <p class="muted">Reports heard (LIVE): ${family} from your family, ${pub} public.</p>`;
    },
  };
}

/** The page's one ledger, shared by this tab and the Listen tab's odds line; fed before any screen draws. */
export const shared = ledgerView();
app.on('reading', (r) => shared.reading(r));
app.on('packet', ({ decoded }) => shared.packet(decoded));

export function mountLedger(root: HTMLElement) {
  root.innerHTML = `
    <h2>Odds of a power cut</h2>
    <p class="muted">Chance each level loses power the next time the grid is under strain, from what neighbours reported.</p>
    <div id="ledgerOut"></div>
    <details><summary>How this is worked out</summary><p class="muted">Each number estimates the chance a level is cut in the next stress event at that tier. It
      starts from an even guess and moves toward what neighbours reported, so a few events never give 0% or 100%.
      A level counts as cut in an event when 3 different phones report it without power during the event or the
      10 minutes after. It cannot say who sent a report: anyone can send public reports, and one person can pose
      as three. A level already dark before the event counts too. A level with fewer than 3 phones reporting has
      no data yet. The event happening now counts once it is over.</p></details>
    <p class="muted">Kept in this page's memory only: the ledger resets when the page reloads.</p>`;

  const out = $('#ledgerOut', root);
  let shown = '';

  function render() {
    const html = app.listening
      ? shared.html(app.lastReading?.tier)
      : `<p id="ledger-empty">Not listening. Start listening on the Listen tab: this phone then records the
          stress events it hears and the power reports neighbours send.</p>
        <button onclick="location.hash = 'listen'">Go to Listen</button>`;
    if (html !== shown) out.innerHTML = shown = html;
  }

  app.on('reading', render);
  app.on('packet', render);
  app.on('listening', render);
  render();
}
