import { defineConfig } from 'vite';

// Multi-page: the hello page plus the throwaway spike pages.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: ['index.html', 'spikes/emitter.html', 'spikes/listener.html', 'spikes/packets.html'],
    },
  },
});
