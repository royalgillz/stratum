// p08 Families (design: docs/intent/adapters/family/family-design.md, "p08: families").
// Splits families across levels, queues the away members' OK beacons, and keeps the family board.
import type { Adapter, Label, World } from '../contracts.ts';
import { MAX_HOPS, TYPES, VERSION } from '../packet/codec.ts';
import type { Script } from '../scenario/types.ts';
import type { Policy } from './shared.ts';

// Every value below is listed in docs/params.md.
export const FIRST_WINDOW = 1800; // s, first beacon within this of the separation
export const BEACON_EVERY = 6 * 3600; // s

interface Away { id: string; member: number; level: number; sector: number; next: number; known: boolean }

export function createP08(_policy: Policy, script: Script): Adapter {
  const sep = script.events.find((e) => e.type === 'separate');
  const sepT = sep ? sep.atH * 3600 : Infinity;
  const away = new Map<string, Away>(); // `${household}/${member}`, in household order
  let separated = false, cursor = 0, unknownH = 0;

  return {
    id: 'p08',
    reads: ['mesh', 'households'],
    writes: ['mesh'],
    step(world, dt, rng) {
      const t = world.t;
      // @spec ADAPT-FAMILY-007
      if (sep && sepT >= t && sepT < t + dt) {
        for (const h of world.households) {
          if (h.id === script.demo.id) continue;
          const others = [1, 2, 3, 4, 5, 6].filter((l) => l !== h.level);
          for (let member = 1; member < h.members; member++) {
            const [u, ul, us, ud] = [rng(), rng(), rng(), rng()];
            if (u < sep.away) {
              away.set(`${h.id}/${member}`, { id: h.id, member, level: others[Math.floor(ul * 5)], sector: Math.floor(us * 4), next: sepT + ud * FIRST_WINDOW, known: false });
            }
          }
        }
        separated = true;
      }
      // @spec ADAPT-FAMILY-009
      const d = world.mesh.delivered;
      for (; cursor < d.length; cursor++) {
        const h = d[cursor].heard;
        if (h?.label === 'SIMULATED' && h.type === TYPES.OK && d[cursor].at >= sepT) {
          const a = away.get(`${h.keySet}/${h.payload.member}`);
          if (a) a.known = true;
        }
      }
      // @spec ADAPT-FAMILY-010
      if (separated) for (const a of away.values()) if (!a.known) unknownH += dt / 3600;
      // @spec ADAPT-FAMILY-008
      for (const a of away.values()) {
        for (; a.next < t + dt; a.next += BEACON_EVERY) {
          const bytes = Uint8Array.from({ length: 25 }, () => Math.floor(rng() * 256));
          bytes[0] = (VERSION << 4) | TYPES.OK;
          bytes[16] = MAX_HOPS;
          world.mesh.inbox.push({
            at: a.next,
            bytes,
            heard: { type: TYPES.OK, keySet: a.id, minute: Math.floor(a.next / 60), payload: { member: a.member, code: 0, level: a.level, sector: a.sector, flags: 0, value: 0 }, label: 'SIMULATED' },
          });
        }
      }
    },
    metric: () => ({ name: 'mean hours until status known', value: away.size > 0 ? unknownH / away.size : 0, unit: 'h', label: 'SIMULATED' }),
  };
}

export interface BoardEntry { at: number; minute: number; level: number; sector: number; label: Label }

/** Latest delivered OK per household id and member number. Reads the world only. */
// @spec ADAPT-FAMILY-011, ADAPT-FAMILY-012
export function familyBoard(world: World): Record<string, Record<number, BoardEntry>> {
  const board: Record<string, Record<number, BoardEntry>> = {};
  for (const m of world.mesh.delivered) {
    const h = m.heard;
    if (!h || h.type !== TYPES.OK) continue;
    const row = (board[h.keySet] ??= {});
    const prev = row[h.payload.member];
    if (!prev || m.at >= prev.at) row[h.payload.member] = { at: m.at, minute: h.minute, level: h.payload.level, sector: h.payload.sector, label: h.label };
  }
  return board;
}
