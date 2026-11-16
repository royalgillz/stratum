// The district gateway's one pure step: a decoded packet heard in the room becomes a LIVE MeshMessage for the runs.
// The microphone, the modem and the codec run on the page; this decides what is injected and what the log says.
import type { MeshMessage } from '../core/contracts.ts';
import { TYPES, type Decoded, type Reject } from '../core/packet/codec.ts';

const NAME = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k.replace('_', ' ')]));

/** The message to inject (family packets heard for the first time only) and a log line that never shows the bytes. */
export function toMessage(r: Decoded | Reject, bytes: Uint8Array): { message?: MeshMessage; note: string } {
  if ('reject' in r) return { note: `Rejected: ${r.reject === 'unknown-tag' ? 'not this family (or damaged)' : r.reject}` };
  const what = `${NAME[r.type]} from member ${r.payload.member}`;
  if (r.public) return { note: `Public ${what}: not a family message, not added to the board` };
  if (r.duplicate) return { note: `Repeat of ${what}, heard ${r.timesHeard} times: already on the board` };
  return {
    message: { at: 0, bytes, heard: { type: r.type, keySet: r.keySet, minute: r.minute, payload: r.payload, label: 'LIVE' } },
    note: `Verified ${what}`,
  };
}
