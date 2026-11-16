// The phone's message set: what each codebook byte means. The codec only carries the byte
// (packet design: codebook values belong to the phone, not the codec). Outside LID scope.

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
