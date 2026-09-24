import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: process.env.E2E_OUTPUT_DIR ?? join(tmpdir(), 'tq-playwright-results'),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // tests use distinct accounts, but share one fresh seeded database
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:18081',
    timezoneId: 'Asia/Amman',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
