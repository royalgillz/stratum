// The adapter set for one run (design: docs/intent/adapters/policy/policy-design.md, "Factory").
import type { Adapter, AdapterId } from '../contracts.ts';
import type { Script } from '../scenario/types.ts';
import { createP01 } from './p01.ts';
import { createP02 } from './p02.ts';
import { createP03 } from './p03.ts';
import { createP04 } from './p04.ts';
import { createP05 } from './p05.ts';
import { createP06 } from './p06.ts';
import { createP07 } from './p07.ts';
import { createP08 } from './p08.ts';
import { createP09 } from './p09.ts';
import { createP10 } from './p10.ts';
import { createP11 } from './p11.ts';
import { createP12 } from './p12.ts';
import { createP13 } from './p13.ts';
import { createP14 } from './p14.ts';
import { createP15 } from './p15.ts';
import type { Policy } from './shared.ts';

const FACTORIES = [createP01, createP02, createP03, createP04, createP05, createP06, createP07, createP08, createP09, createP10, createP11, createP12, createP13, createP14, createP15];

const IDS = FACTORIES.map((_, i) => `p${String(i + 1).padStart(2, '0')}`);
const isPolicy = (p: unknown): p is Policy => p === 'directorate' || p === 'stratum';

// @spec ADAPT-POLICY-001, ADAPT-POLICY-010
export function createAdapters(policy: Policy, script: Script, per: Partial<Record<AdapterId, Policy>> = {}): Adapter[] {
  if (!isPolicy(policy)) throw new RangeError(`unknown policy ${String(policy)}`);
  for (const [id, p] of Object.entries(per)) if (!IDS.includes(id) || !isPolicy(p)) throw new RangeError(`bad per-adapter policy ${id}: ${String(p)}`);
  return FACTORIES.map((f, i) => f(per[IDS[i] as AdapterId] ?? policy, script));
}
