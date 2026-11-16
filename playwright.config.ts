import { defineConfig } from '@playwright/test';

// Every UI test runs on every viewport below (CLAUDE.md UI rule). Chromium emulates all of them.
// Fold 6 sizes are approximate CSS viewports: cover 968 x 2376 px and inner 1856 x 2160 px at a
// device pixel ratio of about 2.6.
const CI = Boolean((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.CI); // no @types/node
const touch = { hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 2, // the local preview server occasionally stalls under load; retries are reported as flaky, not hidden
  workers: 4, // more parallel browsers than this overload the local preview server on Windows
  reporter: CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    permissions: ['microphone'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    trace: 'retain-on-failure',
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'laptop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, ...touch } },
    { name: 'phone', use: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, ...touch } },
    { name: 'fold6-cover', use: { viewport: { width: 369, height: 905 }, deviceScaleFactor: 2.625, ...touch } },
    { name: 'fold6-open', use: { viewport: { width: 714, height: 831 }, deviceScaleFactor: 2.6, ...touch } },
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
