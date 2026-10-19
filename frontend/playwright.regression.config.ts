import { defineConfig, devices } from '@playwright/test';

// This suite requires a running LOCAL frontend, backend, and migrated database.
// It deliberately does not import e2e/fixtures.ts or mock network responses.
export default defineConfig({
  testDir: './regression',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: process.env.REGRESSION_OUTPUT_DIR ?? './regression-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: process.env.REGRESSION_REPORT_DIR ?? './regression-report', open: 'never' }],
    ['json', { outputFile: process.env.REGRESSION_JSON_REPORT ?? './regression-results/results.json' }],
  ],
  use: {
    baseURL: process.env.REGRESSION_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium-live',
    use: {
      ...devices['Desktop Chrome'],
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ['--no-sandbox'],
        },
      } : {}),
    },
  }],
});
