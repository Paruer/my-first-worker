import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') } },
          }),
        ],
        test: { name: 'worker', include: ['test/worker/*.spec.{js,ts}'] },
      },
      {
        plugins: [svelte(), svelteTesting()],
        test: { name: 'ui', environment: 'jsdom', include: ['test/ui/**/*.spec.ts'] },
      },
    ],
  },
});
