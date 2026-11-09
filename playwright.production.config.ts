import { defineConfig } from '@playwright/test';

// Deliberately has no local web server: this suite checks the deployed assets.
export default defineConfig({
  testDir: './production-tests',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.TEXLA_AUDIT_URL || 'https://mcjey71-crypto.github.io/texla-mvp/',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  reporter: 'list',
});
