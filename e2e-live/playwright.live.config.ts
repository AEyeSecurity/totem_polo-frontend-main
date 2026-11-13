import { defineConfig } from '@playwright/test';

// Recorrido E2E completo "en vivo": navegador visible y lento, contra el
// backend local (localhost:8000) y el front de `ng serve` (localhost:4200).
export default defineConfig({
  testDir: '.',
  testMatch: /sistema\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60 * 1000,
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    headless: false,
    viewport: { width: 1400, height: 880 },
    actionTimeout: 15000,
    screenshot: 'only-on-failure',
    permissions: ['microphone'],
    launchOptions: {
      slowMo: 350,
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  webServer: {
    command: 'npm run start -- --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180 * 1000,
    cwd: '..',
  },
});
