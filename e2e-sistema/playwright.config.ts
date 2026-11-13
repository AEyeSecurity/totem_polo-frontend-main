import { defineConfig, devices } from '@playwright/test';

// Suite E2E completa contra backend y base reales (ver helpers.ts).
//   npx playwright test -c e2e-sistema                 -> todas las partes, navegador visible
//   npx playwright test -c e2e-sistema 01-             -> solo la parte 1
//   E2E_HEADLESS=1 npx playwright test -c e2e-sistema  -> sin ventana
// Corre en serie (workers: 1): comparte datos en la base y el rate limit de /login.
export default defineConfig({
  testDir: '.',
  testMatch: /\d\d-.*\.spec\.ts/,
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    headless: process.env.E2E_HEADLESS === '1',
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO ?? 250) },
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 880 } } }],
  webServer: {
    command: 'npm run start -- --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
    cwd: '..',
  },
});
