import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';

// Offline: after the build writes dist, list every file in it and write dist/sw.js, whose cache name
// is a hash of all their contents, so each deploy gets a new cache; older ones are deleted, all but the newest.
// Build only, so dev never registers a worker; every page gets the manifest link and the registration.
function offline(): Plugin {
  let out = '';
  return {
    name: 'stratum-offline',
    apply: 'build',
    configResolved: (c) => { out = resolve(c.root, c.build.outDir); },
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'theme-color', content: '#1a4fa0' }, injectTo: 'head' },
      { tag: 'script', children: "if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');", injectTo: 'body' },
    ],
    async closeBundle() {
      const files = readdirSync(out, { recursive: true, withFileTypes: true }).filter((f) => f.isFile() && f.name !== 'sw.js')
        .map((f) => '/' + relative(out, join(f.parentPath, f.name)).replaceAll('\\', '/')).sort();
      const all = await new Blob([files.join(), ...files.map((f) => readFileSync(join(out, f)) as Uint8Array<ArrayBuffer>)]).arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', all))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const urls = files.map((f) => f.replace(/(^|\/)index\.html$/, '$1')); // pages are opened as /src/phone/, not /src/phone/index.html
      writeFileSync(join(out, 'sw.js'), `// Written by vite.config.ts at build time.
const CACHE = 'stratum-${hash.slice(0, 12)}';
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
// Keep the newest older cache too: a page still open on the previous build loads its worklet only when Listen is pressed.
self.addEventListener('activate', (e) => e.waitUntil(caches.keys() // oldest first
  .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).slice(0, -1).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// This build's cache first: caches.match alone searches the oldest cache first, so an older copy would shadow this one.
// ignoreVary: servers send Vary: Origin, and module scripts carry an Origin header that the precache requests did not.
const cached = (r, ignoreSearch) => caches.open(CACHE).then((c) => c.match(r, { ignoreSearch, ignoreVary: true }))
  .then((m) => m || caches.match(r, { ignoreSearch, ignoreVary: true }));
// At most 3 s for the network: a router or cell network that connects but never answers must not hide the offline copy.
const net = (r) => Promise.race([fetch(r), new Promise((_, no) => setTimeout(no, 3000))]);
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(new URL(r.url).pathname.startsWith('/assets/')
    ? cached(r, false).then((m) => m || fetch(r)) // hashed names never change: cache first
    : net(r).catch(() => cached(r, r.mode === 'navigate').then((m) => m || fetch(r)))); // pages, evidence, ggwave, manifest: network first, so one load never mixes two deploys
});
`);
    },
  };
}

// Multi-page: the hello page, the phone page, the District 7 page, its coverage matrix, judge mode and the throwaway spike pages.
export default defineConfig({
  plugins: [offline()],
  build: {
    rolldownOptions: {
      input: ['index.html', 'src/phone/index.html', 'src/district/index.html', 'src/district/judge.html', 'src/district/coverage.html', 'spikes/emitter.html', 'spikes/listener.html', 'spikes/packets.html'],
    },
  },
  test: {
    exclude: [...configDefaults.exclude, '.*/**', 'e2e/**'], // worktrees hold copies; e2e/ belongs to Playwright
    // The wall-time specs (SCEN-009) run alone, after every other file, so parallel test files do not slow them.
    projects: [
      { extends: true, test: { name: 'unit', exclude: ['**/speed.test.ts'] } },
      { extends: true, test: { name: 'speed', include: ['**/speed.test.ts'], sequence: { groupOrder: 1 } } },
    ],
  },
});
