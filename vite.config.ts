import { configDefaults, defineConfig } from 'vitest/config';

// Multi-page: the hello page, the phone page, and the throwaway spike pages.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: ['index.html', 'src/phone/index.html', 'spikes/emitter.html', 'spikes/listener.html', 'spikes/packets.html'],
    },
  },
  test: {
    exclude: [...configDefaults.exclude, '.*/**', 'e2e/**'], // worktrees hold copies; e2e/ belongs to Playwright
  },
});
