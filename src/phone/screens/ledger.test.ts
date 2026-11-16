import { describe, expect, it } from 'vitest';
import type { Decoded } from '../../core/packet/codec.ts';
import { TYPES } from '../../core/packet/codec.ts';
import type { Reading } from '../../core/tracker/tracker.ts';
import { ledgerView, oddsCell } from './ledger.ts';

describe('oddsCell', () => {
  it('prints a muted "no data yet", never 50%, when no event was observed', () => {
    expect(oddsCell({ p: 0.5, cuts: 0, events: 0, label: 'LIVE' })).toBe('<span class="muted">no data yet</span>');
  });
  it('prints the percentage in bold and its evidence', () => {
    expect(oddsCell({ p: 4 / 7, cuts: 3, events: 5, label: 'LIVE' })).toBe('<strong>57%</strong>\n3 cuts in 5 observed events');
    expect(oddsCell({ p: 2 / 3, cuts: 1, events: 1, label: 'LIVE' })).toBe('<strong>67%</strong>\n1 cut in 1 observed event');
    expect(oddsCell({ p: 1 / 3, cuts: 0, events: 1, label: 'LIVE' })).toBe('<strong>33%</strong>\n0 cuts in 1 observed event');
  });
});

describe('ledgerView', () => {
  const T0 = 1_800_000_000_000; // a whole minute
  const reading = (tier?: Reading['tier']): Reading => ({ t: 0, state: tier ? 'LIVE' : 'NO_HUM', snrDb: 20, label: 'LIVE', tier });
  const report = (member: number, extra: Partial<Decoded> = {}): Decoded => ({
    type: TYPES.REPORT, payload: { member, code: 0, level: 2, sector: 0, flags: 0, value: 0 }, hops: 0,
    minute: T0 / 60000 + 2, keySet: 'fam', public: false, duplicate: false, timesHeard: 1, ...extra,
  });
  const cells = (html: string, level: number) =>
    [...html.matchAll(/<tr><th scope="row">(\d)<\/th>(.*?)<\/tr>/gs)].find((m) => m[1] === String(level))![2];

  it('turns tiers and power reports into odds, marks the current column, and counts reports by kind', () => {
    let now = T0;
    const v = ledgerView(() => now);
    v.reading(reading('GREEN'));
    now += 60_000; v.reading(reading('RED'));
    for (const m of [1, 2, 3]) v.packet(report(m)); // three distinct phones: level 2 without power
    v.packet(report(1, { duplicate: true })); // a second hearing counts once
    v.packet(report(9, { public: true, keySet: 'public', payload: { member: 9, code: 0, level: 5, sector: 0, flags: 1, value: 0 } }));
    now += 60_000; v.reading(reading()); // NO HUM keeps the tier
    now += 3 * 60_000; v.reading(reading('GREEN'));
    expect(cells(v.html('RED'), 2)).toContain('no data yet'); // still inside the 10 minutes after
    now += 10 * 60_000;
    const html = v.html('RED');
    // RED lifts AMBER too, so both columns saw the one event.
    expect(cells(html, 2)).toBe('<td><strong>67%</strong>\n1 cut in 1 observed event</td><td class="now"><strong>67%</strong>\n1 cut in 1 observed event</td>');
    expect(cells(html, 3)).toBe('<td><span class="muted">no data yet</span></td><td class="now"><span class="muted">no data yet</span></td>');
    expect(html).toContain('<th scope="col" class="now">■ RED (now)</th>');
    expect(html).toContain('<th scope="col">▲ AMBER</th>');
    expect(html).toContain('(LIVE)');
    expect(html).toContain('Reports heard (LIVE): 3 from your family, 1 public.');
    expect(v.html()).not.toContain('class="now"'); // GREEN, NO HUM and calibrating mark nothing
  });
});
