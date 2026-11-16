// The rung 3 adapter set for one run (design: docs/intent/adapters/policy/policy-design.md, "Factory").
import type { Adapter } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { createP01 } from './p01.ts';
import { createP02 } from './p02.ts';
import { createP03 } from './p03.ts';
import { createP04 } from './p04.ts';
import { createP05 } from './p05.ts';
import { createP07 } from './p07.ts';
import { createP08 } from './p08.ts';
import { createP09 } from './p09.ts';
import type { Policy } from './shared.ts';

// @spec ADAPT-POLICY-001
export function createAdapters(policy: Policy, script: Script): Adapter[] {
  if (policy !== 'directorate' && policy !== 'stratum') throw new RangeError(`unknown policy ${String(policy)}`);
  return [createP01, createP02, createP03, createP04, createP05, createP07, createP08, createP09].map((f) => f(policy, script));
}
