/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Headless checks against the production build, including airplane mode.
 */

import { defineConfig } from '@playwright/test';

const BASE = process.env.VITE_BASE || '/';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: `http://127.0.0.1:4173${BASE}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
