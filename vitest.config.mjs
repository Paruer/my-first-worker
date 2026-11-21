import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
        test: { name: 'worker', include: ['test/worker/*.spec.js'] },
      },
      {
        plugins: [svelte(), svelteTesting()],
        test: { name: 'ui', environment: 'jsdom', include: ['test/ui/**/*.spec.ts'] },
      },
    ],
  },
});
