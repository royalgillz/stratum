// Family and public key sets for packet v3 (design: docs/intent/packet/packet-design.md § Keys).
import { WORDS } from './wordlist.ts';

export interface KeySet {
  id: string; // caller-chosen for families; 'public' for the public set
  tag: CryptoKey;
  enc: CryptoKey;
  mac: CryptoKey;
}

export type KeyError = { error: 'word-count' } | { error: 'unknown-word'; word: string };

const PUBLIC_PHRASE = 'stratum public channel';
const utf8 = (s: string) => new TextEncoder().encode(s);
const INDEX = new Map(WORDS.map((w, i) => [w, i]));

async function derive(material: string, id: string): Promise<KeySet> {
  const base = await crypto.subtle.importKey('raw', utf8(material), 'HKDF', false, ['deriveKey']);
  const key = (info: string) =>
    crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: utf8('STRATUM-v3'), info: utf8(info) },
      base,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    );
  const [tag, enc, mac] = await Promise.all([key('tag'), key('enc'), key('mac')]);
  return { id, tag, enc, mac };
}

// @spec PKT-003
export async function deriveKeys(typed: string, id: string): Promise<KeySet | KeyError> {
  const words = typed.normalize('NFKD').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length !== 6) return { error: 'word-count' };
  const unknown = words.find((w) => !INDEX.has(w));
  if (unknown !== undefined) return { error: 'unknown-word', word: unknown };
  return derive(words.join(' '), id);
}

export const publicKeys = (): Promise<KeySet> => derive(PUBLIC_PHRASE, 'public');

// @spec PKT-004
export function generateWords(random: Uint8Array): string[] {
  if (random.length !== 9) throw new RangeError('generateWords needs 9 random bytes (66 bits used)');
  const bits = Array.from(random, (b) => b.toString(2).padStart(8, '0')).join('');
  return Array.from({ length: 6 }, (_, i) => WORDS[parseInt(bits.slice(i * 11, i * 11 + 11), 2)]);
}
