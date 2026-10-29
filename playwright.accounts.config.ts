import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './account-tests', timeout: 45000, workers: 1,
  webServer: [{ command: 'npm run dev -- --port 5176 --strictPort', url: 'http://127.0.0.1:5176', reuseExistingServer: false, env: { TEXLA_VITE_CACHE: 'node_modules/.vite-accounts', VITE_SUPABASE_URL: 'https://texla-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' } },
    {command:'npx wrangler dev --env test --port 8790 --ip 127.0.0.1 --persist-to /tmp/texla-account-collab-state',url:'http://127.0.0.1:8790/health',reuseExistingServer:false,env:{CLOUDFLARE_SEND_METRICS:'false',XDG_CONFIG_HOME:'/tmp/texla-test-config',XDG_CACHE_HOME:'/tmp/texla-test-cache'}}],
  use: { baseURL: 'http://127.0.0.1:5176', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } }, reporter: 'list'
});
