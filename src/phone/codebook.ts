// The phone's message set: what each codebook byte means. The codec only carries the byte
// (packet design: codebook values belong to the phone, not the codec). Outside LID scope.
import { TYPES, type Payload } from '../core/packet/codec.ts';

export type KeyChoice = 'family' | 'public';

export interface Entry {
  code: number; // payload code byte, unique across the table so a reader needs no type to look it up
  type: 'OK' | 'NEED' | 'REPORT';
  label: string;
  icon: string;
  keys: readonly KeyChoice[]; // allowed key sets; the first is the default
  power?: boolean; // set: the code fixes the power flag; unset: the "Power on here" box decides
  count?: boolean; // the value field carries how many people are affected
}

const FAMILY = ['family'] as const, NEED = ['family', 'public'] as const, REPORT = ['public', 'family'] as const;

export const CODEBOOK: readonly Readonly<Entry>[] = Object.freeze(([
  { code: 0x00, type: 'OK', label: 'I am OK', icon: '✅', keys: FAMILY },
  { code: 0x20, type: 'NEED', label: 'Medicine', icon: '💊', keys: NEED, count: true },
  { code: 0x21, type: 'NEED', label: 'Clean water', icon: '🚰', keys: NEED, count: true },
  { code: 0x22, type: 'NEED', label: 'Food', icon: '🍞', keys: NEED, count: true },
  { code: 0x23, type: 'NEED', label: 'Medic visit', icon: '🩺', keys: NEED, count: true },
  { code: 0x24, type: 'NEED', label: 'Help moving someone', icon: '🦽', keys: NEED, count: true },
  { code: 0x10, type: 'REPORT', label: 'Power cut here', icon: '🔌', keys: REPORT, power: false },
  { code: 0x11, type: 'REPORT', label: 'Power back', icon: '💡', keys: REPORT, power: true },
  { code: 0x12, type: 'REPORT', label: 'Water looks wrong', icon: '🚱', keys: REPORT },
  { code: 0x13, type: 'REPORT', label: 'Flooding or route blocked', icon: '🌊', keys: REPORT },
  { code: 0x14, type: 'REPORT', label: 'Fan stopped or air hot', icon: '🌡️', keys: REPORT },
  { code: 0x15, type: 'REPORT', label: 'People coughing or sick', icon: '🤒', keys: REPORT, count: true },
] satisfies Entry[]).map((e) => Object.freeze(e)));

export interface Choice { member: number; level: number; sector: number; power: boolean; count: string; to: KeyChoice }

/** What goes on air for an entry: the key set and the packet fields. A key set the entry does not allow falls back to its default. */
export function message(e: Entry, c: Choice): { keys: KeyChoice; type: number; payload: Payload } {
  return {
    keys: e.keys.includes(c.to) ? c.to : e.keys[0],
    type: TYPES[e.type],
    payload: {
      member: c.member, code: e.code, level: c.level, sector: c.sector,
      flags: (e.power ?? c.power) ? 1 : 0, value: e.count ? Number(c.count) || 0 : 0, // 0 = count not given
    },
  };
}
