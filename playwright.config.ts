import { defineConfig } from "@playwright/test";

const profile = process.env.CANDYBOX_TEST_PROFILE === "production"
  ? "production"
  : "development";
const isProduction = profile === "production";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173/candybox-phaser/",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: isProduction
      ? "npm run build:prod && npm run preview:prod"
      : "npm run build:dev && npm run preview:dev",
    url: "http://127.0.0.1:4173/candybox-phaser/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
