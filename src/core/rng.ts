// The only source of randomness in src/core. Each module draws from its own named stream,
// so adding draws in one module never shifts another module's sequence.

/** Uniform in [0, 1). */
export type Rng = () => number;

// FNV-1a over the stream name, mixed with the seed: a distinct 32-bit state per (seed, name).
function hash(seed: number, name: string): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** mulberry32 seeded from (seed, stream). Same inputs, same sequence, on every runtime. */
export function rng(seed: number, stream: string): Rng {
  let a = hash(seed, stream);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
