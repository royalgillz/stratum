// Phone page shell: tabs and routing. Each screen lives in src/phone/screens and talks to the
// others only through `app` events (src/phone/app.ts). Outside src/core.
import { mountAlerts } from './alerts.ts';
import { $, app, store } from './app.ts';
import { mountCare } from './screens/care.ts';
import { mountFamily } from './screens/family.ts';
import { mountLedger } from './screens/ledger.ts';
import { mountListen } from './screens/listen.ts';
import { mountReport } from './screens/report.ts';

const screens: Record<string, (root: HTMLElement) => void> = {
  listen: mountListen,
  report: mountReport,
  family: mountFamily,
  ledger: mountLedger,
  care: mountCare,
};
for (const [name, mount] of Object.entries(screens)) mount($(`#screen-${name}`));
mountAlerts();

const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')];

function show(name: string) {
  const tab = tabs.find((t) => t.dataset.screen === name && !t.hidden) ?? tabs[0];
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  }
  if (location.hash !== `#${tab.dataset.screen}`) history.replaceState(null, '', `#${tab.dataset.screen}`);
}

for (const t of tabs) t.onclick = () => show(t.dataset.screen!);
// Arrow keys move between visible tabs (WAI-ARIA tabs pattern).
$('.tabs').addEventListener('keydown', (e) => {
  const visible = tabs.filter((t) => !t.hidden);
  const i = visible.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
  const next = visible[(i + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
  next.focus();
  show(next.dataset.screen!);
});
window.addEventListener('hashchange', () => {
  show(location.hash.slice(1));
  // A "Go to ..." button hid its own panel: put focus on the new tab, not the page.
  const a = document.activeElement;
  if (!a || a === document.body || a.closest('[role=tabpanel][hidden]')) tabs.find((t) => t.tabIndex === 0)?.focus();
});
show(location.hash.slice(1) || 'listen');

// Test-only seam: CI has no microphone, so ?test feeds 25 bytes into the path the modem feeds.
if (new URLSearchParams(location.search).has('test')) Object.assign(window, { phoneTest: { hear: (b: number[]) => app.receive(new Uint8Array(b)) } });

const saved = store.get('stratum.words');
if (saved) void app.join(saved);
