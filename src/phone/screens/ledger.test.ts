import { describe, expect, it } from 'vitest';
import { oddsText } from './ledger.ts';

describe('oddsText', () => {
  it('prints "no data yet", never 50%, when no event was observed', () => {
    expect(oddsText({ p: 0.5, cuts: 0, events: 0, label: 'LIVE' })).toBe('no data yet');
  });
  it('prints the percentage and its evidence', () => {
    expect(oddsText({ p: 4 / 7, cuts: 3, events: 5, label: 'LIVE' })).toBe('57%\n3 cuts in 5 observed events');
    expect(oddsText({ p: 2 / 3, cuts: 1, events: 1, label: 'LIVE' })).toBe('67%\n1 cut in 1 observed event');
    expect(oddsText({ p: 1 / 3, cuts: 0, events: 1, label: 'LIVE' })).toBe('33%\n0 cuts in 1 observed event');
  });
});
