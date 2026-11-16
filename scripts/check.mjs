#!/usr/bin/env node
// Repo checks that typecheck and tests cannot catch. Exits 1 on any failure.
// 1. Every @spec annotation cites a spec ID that exists in docs/intent/**/*-specs.md.
// 2. Every spec marked [x] (implemented) is cited by at least one test.
// 3. src/core uses no browser APIs and no randomness outside rng.ts (project rules).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const walk = (dir) => {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  } catch {
    return []; // directory not created yet
  }
};
const rel = (p) => relative(root, p).replaceAll('\\', '/');
const errors = [];

const specs = new Map(); // id -> marker
for (const f of walk(join(root, 'docs/intent')).filter((f) => f.endsWith('-specs.md'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/^- \[(.)\] \*\*([A-Z][A-Z0-9-]*-\d{3})\*\*/gm)) specs.set(m[2], m[1]);
}

const code = walk(join(root, 'src')).filter((f) => /\.(ts|js|mjs)$/.test(f));
const cited = new Map(); // id -> files citing it
for (const f of code) {
  for (const m of readFileSync(f, 'utf8').matchAll(/@spec\s+([A-Z0-9-]+(?:\s*,\s*[A-Z0-9-]+)*)/g)) {
    for (const id of m[1].split(/\s*,\s*/)) {
      if (!specs.has(id)) errors.push(`${rel(f)}: @spec ${id} does not exist in any *-specs.md`);
      cited.set(id, [...(cited.get(id) ?? []), f]);
    }
  }
}

for (const [id, marker] of specs) {
  if (marker === 'x' && !(cited.get(id) ?? []).some((f) => /\.test\.ts$/.test(f))) {
    errors.push(`${id} is marked [x] but no test cites it`);
  }
}

const forbidden = /\b(window|document|navigator|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|AudioContext|Math\.random)\b/;
for (const f of code.filter((f) => rel(f).startsWith('src/core/') && !f.endsWith('.test.ts'))) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    // Comments and string literals may name forbidden things (the word list holds "window").
    const m = line.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '').replace(/\/\/.*$/, '').match(forbidden);
    if (m) errors.push(`${rel(f)}:${i + 1}: ${m[1]} is not allowed in src/core`);
  });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`check: ${specs.size} specs, ${cited.size} cited, src/core clean`);
