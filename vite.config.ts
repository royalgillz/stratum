import { configDefaults, defineConfig } from 'vitest/config';

// Multi-page: the hello page, the phone page, the District 7 page, judge mode and the throwaway spike pages.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: ['index.html', 'src/phone/index.html', 'src/district/index.html', 'src/district/judge.html', 'spikes/emitter.html', 'spikes/listener.html', 'spikes/packets.html'],
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
