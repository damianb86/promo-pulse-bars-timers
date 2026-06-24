import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import {
  getConfig,
  loadRealE2EEnv,
  storageStateAbsolutePath,
} from "./tests/e2e-real/helpers/env";

loadRealE2EEnv();

const config = getConfig();
const storageState = storageStateAbsolutePath();
const storageStateIfPresent = fs.existsSync(storageState)
  ? storageState
  : undefined;

export default defineConfig({
  testDir: "./tests/e2e-real",
  timeout: config.timeoutMs,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.resolve(process.cwd(), "playwright-report-real"),
        open: "never",
      },
    ],
  ],
  use: {
    baseURL: config.storefrontUrl || undefined,
    headless: config.headless,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: config.timeoutMs,
  },
  outputDir: "test-results/real-e2e",
  projects: [
    {
      name: "chromium-admin",
      testMatch: [
        "**/00.real-prerequisites.spec.ts",
        "**/01.admin-campaign-crud.spec.ts",
        "**/09.experiments.spec.ts",
        "**/10.analytics-reports.spec.ts",
        "**/11.templates-ai.spec.ts",
        "**/12.settings-billing.spec.ts",
        "**/14.design-timer-configuration.spec.ts",
        "**/15.order-create.spec.ts",
        "**/18.offers-discounts-email.spec.ts",
        "**/19.experiments-winner-analytics.spec.ts",
        "**/23.behavior-targeting-editor.spec.ts",
        "**/99.cleanup.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageStateIfPresent,
      },
    },
    {
      name: "chromium-storefront",
      testMatch: [
        "**/00.real-prerequisites.spec.ts",
        "**/02.storefront-countdown-bar.spec.ts",
        "**/03.product-page-blocks.spec.ts",
        "**/04.free-shipping-goal.spec.ts",
        "**/05.delivery-cutoff.spec.ts",
        "**/06.cart-drawer.spec.ts",
        "**/07.targeting-localization-markets.spec.ts",
        "**/08.unique-codes.spec.ts",
        "**/13.checkout-smoke.spec.ts",
        "**/16.placement-matrix.spec.ts",
        "**/17.campaign-types-targeting-schedule.spec.ts",
        "**/21.checkout-discount-order-attribution.spec.ts",
        "**/22.behavior-targeting-segments.spec.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageStateIfPresent,
      },
    },
    {
      name: "mobile-storefront",
      testMatch: [
        "**/02.storefront-countdown-bar.spec.ts",
        "**/03.product-page-blocks.spec.ts",
        "**/06.cart-drawer.spec.ts",
        "**/20.mobile-campaign-rendering.spec.ts",
      ],
      use: {
        ...devices["Pixel 7"],
        storageState: storageStateIfPresent,
      },
    },
  ],
});
