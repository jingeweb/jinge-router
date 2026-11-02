import { defineConfig } from '@playwright/test';
import path from 'node:path';
const port = Number(process.env.ROUTER_TEST_PORT ?? 5198);
const results = path.resolve(import.meta.dirname, '../.results');
export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: '*.spec.mjs',
  workers: 1,
  fullyParallel: false,
  timeout: 15000,
  expect: { timeout: 3000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  outputDir: path.join(results, 'e2e-artifacts'),
  reporter: [['list'], ['json', { outputFile: path.join(results, 'e2e.json') }]],
  use: {
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    headless: true,
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" "${import.meta.dirname}/server.mjs"`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
