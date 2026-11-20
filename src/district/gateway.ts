// The district gateway's one pure step: a decoded packet heard in the room becomes a LIVE MeshMessage for the runs.
// The microphone, the modem and the codec run on the page; this decides what is injected and what the log says.
import type { MeshMessage } from '../core/contracts.ts';
import { NEED_CODES } from '../core/care/breath.ts';
import { payloadDigest, TYPES, type Decoded, type Reject } from '../core/packet/codec.ts';
import { CONFIRM, type TallyRow } from '../core/tally/tally.ts';
import { CODEBOOK } from '../phone/codebook.ts';

const NAME = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k.replace('_', ' ')]));
const DAMAGED = 'damaged or not a STRATUM packet';
const WHY: Record<Reject['reject'], string> = {
  'unknown-tag': 'not this family (or damaged)', stale: 'too old (check the phone clock)', future: 'dated in the future (check the phone clock)',
  mac: DAMAGED, version: DAMAGED, type: DAMAGED, length: DAMAGED,
};

/** What a verified NEED asks for, in the phone's words; an unknown code still shows as a request. */
export function needText({ code, value }: { code: number; value: number }): string {
  if (code === NEED_CODES.BREATH_RED) return 'Medicine request: Breath Count RED (danger sign)';
  if (code === NEED_CODES.BREATH_AMBER) return `Medicine request: Breath Count AMBER (fast breathing${value ? `, ${value} a minute` : ''})`;
  const e = CODEBOOK.find((x) => x.type === 'NEED' && x.code === code);
  const people = e?.count && value ? ` (${value} ${value === 1 ? 'person' : 'people'})` : '';
  return `Needs help: ${e?.label ?? `code ${code}`}${people}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One tally row in plain words: what, where, how many from whom, confirmed or not; a case report adds its people count.
 *  No Chapman estimate: it needs a clinic list for the same sector and the people on both lists, and this page has neither live. */
export function reportText(t: TallyRow, sent: string): { what: string; detail: string; cases?: string } {
  const e = CODEBOOK.find((x) => TYPES[x.type] === t.type && x.code === t.code);
  const what = e ? `${t.type === TYPES.REPORT ? '' : 'Public alert: '}${e.label}` : `${NAME[t.type]} code ${t.code}`;
  const detail = `level ${t.level}, sector ${String.fromCharCode(65 + t.sector)}: ${plural(t.packets, 'report')} from ${plural(t.senders, 'sender')}, `
    + `${t.confirmed ? `confirmed (${CONFIRM} or more senders)` : `unconfirmed (fewer than ${CONFIRM} senders)`}, newest sent ${sent}`;
  if (!e?.count || t.type !== TYPES.REPORT) return { what, detail };
  return { what, detail, cases: `Cases heard by sound: ${t.people ? plural(t.people, 'person', 'people') : 'no count given'} from ${plural(t.senders, 'sender')}. An outbreak estimate (Chapman) needs a clinic list for this sector and who is on both lists; none is live here, so this is the count only.` };
}

/** The message to inject (family packets heard for the first time only) and a log line that never shows the bytes. */
export function toMessage(r: Decoded | Reject, bytes: Uint8Array): { message?: MeshMessage; note: string } {
  if ('reject' in r) return { note: `Rejected: ${WHY[r.reject]}` };
  if (r.type === TYPES.LEDGER_HEAD) return { note: `Public ledger digest ${payloadDigest(r.payload)}: not a family message` }; // no sender: all six bytes are digest
  const what = `${NAME[r.type]} from member ${r.payload.member}`;
  if (r.public) return { note: `Public ${what}: not a family message, not added to the board` };
  if (r.duplicate) return { note: `Repeat of ${what}, heard ${r.timesHeard} times: already on the board` };
  return {
    message: { at: 0, bytes, heard: { type: r.type, keySet: r.keySet, minute: r.minute, payload: r.payload, label: 'LIVE' } },
    note: `Verified ${what}`,
  };
}
