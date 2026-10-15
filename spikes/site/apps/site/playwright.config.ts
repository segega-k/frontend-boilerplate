import { defineConfig } from '@playwright/test';

const port = process.env.PORT ?? '3100';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}`, locale: 'en-US' },
  projects: [
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
