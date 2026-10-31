import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 8788);
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 8 * 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 640 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `cd server && npx wrangler dev --port ${PORT} --var LLM_MODE:off`,
        url: `${BASE}/api/health`,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
