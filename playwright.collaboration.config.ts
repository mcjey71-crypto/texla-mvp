import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: './collaboration-tests', timeout: 60000, workers: 1,
  webServer: [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'npm run collab:dev', url: 'http://127.0.0.1:8787/health', reuseExistingServer: !process.env.CI, env: { CLOUDFLARE_SEND_METRICS: 'false', XDG_CONFIG_HOME: join(tmpdir(), 'texla-test-config'), XDG_CACHE_HOME: join(tmpdir(), 'texla-test-cache') } }
  ],
  use: { baseURL: 'http://127.0.0.1:5173', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } }, reporter: 'list'
});
