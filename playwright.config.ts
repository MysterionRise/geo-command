import { defineConfig } from "@playwright/test";

const nodeExecutable = JSON.stringify(process.execPath);

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: true,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
  },
  webServer: {
    command: `${nodeExecutable} node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000`,
    cwd: "apps/game",
    url: "http://127.0.0.1:3000",
    timeout: 300_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "provenance",
      testMatch: /provenance-flow\.spec\.ts/,
    },
    {
      name: "provenance-accessibility",
      testMatch: /provenance-accessibility\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "language",
      testMatch: /language-flow\.spec\.ts/,
    },
    {
      name: "language-accessibility",
      testMatch: /language-accessibility\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "privacy-accessibility",
      testMatch: /privacy-accessibility\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "arcade",
      testMatch: /(?:arcade-shell|accessibility-local)\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:3000" },
    },
  ],
});
