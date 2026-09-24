import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const workers = Number(process.env.PLAYWRIGHT_WORKERS ?? 1)
const hostedE2E = process.env.ADUEN_HOSTED_E2E === 'true'

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PLAYWRIGHT_PORT must be an integer from 1024 to 65535.')
if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('PLAYWRIGHT_WORKERS must be an integer from 1 to 8.')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: hostedE2E ? {
      VITE_API_BASE_URL: 'https://api.example.test',
      VITE_OIDC_AUTHORITY: 'https://identity.example.test/',
      VITE_OIDC_CLIENT_ID: 'aduen-hosted-e2e',
      VITE_OIDC_REDIRECT_URI: `http://127.0.0.1:${port}/auth/callback`,
      VITE_OIDC_POST_LOGOUT_REDIRECT_URI: `http://127.0.0.1:${port}/`,
      VITE_OIDC_SCOPE: 'openid aduen-api',
    } : {},
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
})
