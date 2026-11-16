import type { LedgerEntry, Witness, World } from '../contracts.ts';
import { createDetector } from './detector.ts';
import { genesis, hashEntry, hex, unhex, validate, type Chain } from './ledger.ts';

const isOfficial = (source: string) => source === 'official' || source.startsWith('official:');

/** Ledger plus detector. `now` supplies world seconds; `ledger` is the caller's World.ledger, appended to in place. */
// @spec WIT-005
export function createWitness(opts: { now: () => number; ledger: World['ledger'] }) {
  const { now, ledger } = opts;
  const detector = createDetector();
  const latest = new Map<string, Map<string, { m?: number; o?: number }>>(); // kind -> where -> latest values

  const note = (e: LedgerEntry, official: boolean) => {
    const byWhere = latest.get(e.kind) ?? latest.set(e.kind, new Map()).get(e.kind)!;
    const slot = byWhere.get(e.where) ?? byWhere.set(e.where, {}).get(e.where)!;
    slot[official ? 'o' : 'm'] = e.value;
    if (!official) detector.push(e.kind, e.where, e.t, e.value);
  };
  ledger.official.forEach((e) => note(e, true));
  ledger.measured.forEach((e) => note(e, false)); // a restored ledger rebuilds the detector

  const headBytes = (chain: Chain) => {
    const list = ledger[chain];
    return list.length ? unhex(list[list.length - 1]!.hash) : genesis(chain);
  };

  return {
    observe(kind: string, where: string, value: number, source: string): void {
      const official = isOfficial(source);
      const chain: Chain = official ? 'official' : 'measured';
      const fields = { t: now(), kind, where, value, source };
      validate(fields);
      const e: LedgerEntry = Object.freeze({ ...fields, hash: hex(hashEntry(headBytes(chain), fields)) });
      ledger[chain].push(e);
      note(e, official);
    },
    // @spec WIT-009
    gap(kind: string): number {
      const pairs = [...(latest.get(kind)?.values() ?? [])].filter((s) => s.m !== undefined && s.o !== undefined);
      return pairs.length ? pairs.reduce((a, s) => a + (s.m! - s.o!), 0) / pairs.length : NaN;
    },
    events: () => detector.events,
    head: (chain: Chain) => hex(headBytes(chain)),
    // @spec WIT-010
    digest: () => hex(headBytes('measured')).slice(0, 32),
  } satisfies Witness & Record<string, unknown>;
}
