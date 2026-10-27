import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './account-tests', timeout: 45000, workers: 1,
  webServer: { command: 'npm run dev -- --port 5176 --strictPort', url: 'http://127.0.0.1:5176', reuseExistingServer: false, env: { VITE_SUPABASE_URL: 'https://texla-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' } },
  use: { baseURL: 'http://127.0.0.1:5176', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } }, reporter: 'list'
});
