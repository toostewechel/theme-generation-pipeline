import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:5181" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5181 --strictPort",
    url: "http://localhost:5181",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
