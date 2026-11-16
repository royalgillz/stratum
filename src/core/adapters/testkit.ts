// Test support for adapter tests: the kernel's write guard sees top-level keys only, this checks sub-fields.
import { expect } from 'vitest';
import type { Adapter, World } from '../contracts.ts';

type Rest = Omit<World, 'ledger'>;
const rest = ({ ledger: _, ...r }: World): Rest => structuredClone(r);

/** `a`, checked on every step against the raw world `w`: once `blank` has cleared the fields `a` owns in copies from before and after, nothing outside the ledger differs; the ledger only grows, by entries whose kind matches `kinds`. */
export function ownOnly(a: Adapter, w: World, blank: (c: Rest) => void, kinds: RegExp): Adapter {
  return {
    ...a,
    step(view, dt, r) {
      const before = rest(w);
      const ledger = w.ledger;
      const old = { measured: [...ledger.measured], official: [...ledger.official] };
      a.step(view, dt, r);
      const after = rest(w);
      blank(before);
      blank(after);
      expect(after).toEqual(before);
      expect(w.ledger).toBe(ledger);
      for (const c of ['measured', 'official'] as const) {
        expect(old[c].every((e, i) => ledger[c][i] === e)).toBe(true); // shortcut: catches replaced entries, not edited ones; verifyChain catches those
        for (const e of ledger[c].slice(old[c].length)) expect(e.kind).toMatch(kinds);
      }
    },
  };
}
