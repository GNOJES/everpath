import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir: './e2e', fullyParallel: false, workers: 1, timeout: 120000,
 expect: { timeout: 10000 }, reporter: 'list',
 use: { baseURL: 'http://127.0.0.1:5187', screenshot: 'only-on-failure', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
 projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
 webServer: { command: 'npm run dev -- --port 5187 --strictPort', url: 'http://127.0.0.1:5187', reuseExistingServer: true, timeout: 15000 },
});
