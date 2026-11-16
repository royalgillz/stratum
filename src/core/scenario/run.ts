// A scenario run: interactive (tick, inject) or headless (design: docs/intent/scenario/scenario-design.md, "Runs").
import type { AdapterId, Label, MeshMessage, World } from '../contracts.ts';
import { createAdapters } from '../adapters/index.ts';
import type { Policy } from '../adapters/shared.ts';
import { createKernel, MAX_STEPS_PER_ADVANCE, type Kernel } from '../kernel/kernel.ts';
import type { Act, Script } from './types.ts';
import { validateScript } from './validate.ts';
import { varyScript } from './vary.ts';
import { createWorld } from './world.ts';

const DT = 60;
const scaleOf = (a: Act) => (a.mode === 'realtime' ? 1 : (a.scale ?? 3600));

export interface Run {
  kernel: Kernel;
  script: Script; // the concrete script of the seed: read event times from here, never from the script passed in
  act(): Act;
  tick(realSeconds: number): number;
  inject(message: MeshMessage): void;
  done(): boolean;
}

export interface Series { name: string; unit: string; label: Label; t: number[]; value: number[] }

// @spec SCEN-004
export function createRun(given: Script, seed: number, policy: Policy, opts: { check?: boolean } = {}): Run {
  validateScript(given);
  const script = varyScript(given, seed);
  const kernel = createKernel(createWorld(seed, script), createAdapters(policy, script), { dt: DT, check: opts.check ?? true });
  const w = kernel.world;
  const end = script.days * 86400;
  const index = () => script.acts.filter((a) => a.atH * 3600 <= w.t).length - 1; // acts rise and start at 0
  const setClock = (a: Act) => {
    if (w.clock.mode !== a.mode || w.clock.scale !== scaleOf(a)) kernel.setClock(a.mode, scaleOf(a));
  };
  return {
    kernel,
    script,
    act: () => script.acts[index()]!,
    // @spec SCEN-005
    tick(realSeconds) {
      if (!(Number.isFinite(realSeconds) && realSeconds >= 0)) throw new RangeError(`bad realSeconds ${realSeconds}`);
      if (w.t >= end) return 0;
      const i = index();
      setClock(script.acts[i]!);
      const next = script.acts[i + 1];
      if (!next || w.t + realSeconds * w.clock.scale < next.atH * 3600) return kernel.advance(Math.min(realSeconds, (end - w.t) / w.clock.scale)); // never past the end
      let steps = 0;
      for (; w.t < next.atH * 3600 && steps < MAX_STEPS_PER_ADVANCE; steps++) kernel.step(); // the cap keeps a resumed tab responsive
      setClock(script.acts[index()]!); // a no-op until the act start is reached
      return steps;
    },
    // @spec SCEN-006
    inject(message) {
      if (!(message?.bytes instanceof Uint8Array && message.bytes.length === 25 && message.heard?.label === 'LIVE')) {
        throw new RangeError('inject takes a 25-byte message heard LIVE');
      }
      w.mesh.inbox.push({ ...message, at: w.t });
    },
    done: () => w.t >= end,
  };
}

// @spec SCEN-007, SCEN-008, SCEN-009
export function runHeadless(script: Script, seed: number, policy: Policy, opts: { sampleEvery?: number; check?: boolean } = {}): { series: Partial<Record<AdapterId, Series>>; world: World } {
  const every = opts.sampleEvery ?? 3600;
  const { kernel } = createRun(script, seed, policy, { check: opts.check });
  const end = script.days * 86400;
  if (!(every > 0 && every % DT === 0 && end % every === 0)) throw new RangeError(`sampleEvery must be a positive multiple of ${DT} dividing ${end}, got ${every}`);
  const series: Partial<Record<AdapterId, Series>> = {};
  const sample = () => {
    for (const [id, m] of Object.entries(kernel.metrics()) as [AdapterId, NonNullable<ReturnType<Kernel['metrics']>[AdapterId]>][]) {
      const s = (series[id] ??= { name: m.name, unit: m.unit, label: m.label, t: [], value: [] });
      s.t.push(kernel.world.t);
      s.value.push(m.value);
    }
  };
  sample();
  while (kernel.world.t < end) {
    kernel.run(every);
    sample();
  }
  return { series, world: kernel.world };
}
