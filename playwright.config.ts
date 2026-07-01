import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const port = Number(process.env.E2E_PORT || 31338);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;
const envFile = readEnvFile(".env");
const appEnv = process.env.APP_ENV || envFile.APP_ENV || "development";
const nodeEnv = process.env.NODE_ENV || envFile.NODE_ENV || "development";
const databaseUrl =
  process.env.DATABASE_URL ||
  (appEnv === "development" || nodeEnv === "development"
    ? process.env.DEVELOPMENT_DATABASE_URL ||
      envFile.DEVELOPMENT_DATABASE_URL ||
      "file:./dev.sqlite"
    : envFile.DATABASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `PORT=${port} npm run test:e2e:web`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
      E2E_TEST_MODE: "true",
      HMR_PORT: String(port + 1000),
      APP_ENV: appEnv,
      NODE_ENV: nodeEnv,
      PORT: String(port),
      PROMO_PULSE_AI_VISUAL_CONTROLS_ENABLED:
        process.env.PROMO_PULSE_AI_VISUAL_CONTROLS_ENABLED ||
        envFile.PROMO_PULSE_AI_VISUAL_CONTROLS_ENABLED ||
        "false",
      PROMO_PULSE_DEV_PLAN: "AGENCY",
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY || "e2e_test_api_key",
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET || "e2e_test_secret",
      SHOPIFY_APP_URL: baseURL,
      SCOPES:
        process.env.SCOPES ||
        "read_products,read_orders,read_discounts,write_discounts,write_pixels,read_customer_events",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results",
});

function readEnvFile(path: string) {
  if (!fs.existsSync(path)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");

        if (separatorIndex === -1) return null;

        const key = line.slice(0, separatorIndex).trim();
        const value = line
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");

        return key ? [key, value] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
}
