import fs from "node:fs";
import path from "node:path";

import type { TestType } from "@playwright/test";

export const E2E_PREFIX = "[PP-E2E]";
export const DISCOUNT_CODE_PREFIX = "PPE2E";

export type RealE2EConfig = {
  adminAccessToken: string;
  adminApiVersion: string;
  adminUrl: string;
  allowCheckout: boolean;
  allowOrder: boolean;
  appAdminUrl: string;
  shopifyAppHandle: string;
  cleanup: boolean;
  debug: boolean;
  enabled: boolean;
  headless: boolean;
  localThemeAssetsFallback: boolean;
  plan: string;
  productHandle: string;
  shopDomain: string;
  storefrontPassword: string;
  storefrontUrl: string;
  storageStatePath: string;
  themeAssetsDir: string;
  themeName: string;
  timeoutMs: number;
};

const REQUIRED_WHEN_ENABLED = [
  "SHOPIFY_SHOP_DOMAIN",
  "SHOPIFY_ADMIN_URL",
  "SHOPIFY_STOREFRONT_URL",
  "PROMO_PULSE_APP_ADMIN_URL",
  "REAL_E2E_STORAGE_STATE",
] as const;

let envLoaded = false;

export function loadRealE2EEnv(envPath = ".env.real-e2e") {
  if (envLoaded) return;
  envLoaded = true;

  const resolvedPath = path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(resolvedPath)) return;

  const content = fs.readFileSync(resolvedPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(line.slice(separatorIndex + 1).trim());

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getConfig(): RealE2EConfig {
  loadRealE2EEnv();

  return {
    adminAccessToken: readEnv("SHOPIFY_ADMIN_ACCESS_TOKEN"),
    adminApiVersion: readEnv("SHOPIFY_ADMIN_API_VERSION", "2026-04"),
    adminUrl: readEnv("SHOPIFY_ADMIN_URL"),
    allowCheckout: readBooleanEnv("REAL_E2E_ALLOW_CHECKOUT", false),
    allowOrder: readBooleanEnv("REAL_E2E_ALLOW_ORDER", false),
    appAdminUrl: readEnv("PROMO_PULSE_APP_ADMIN_URL"),
    shopifyAppHandle: readEnv(
      "PROMO_PULSE_SHOPIFY_APP_HANDLE",
      "promo-pulse-bars-timers",
    ),
    cleanup: readBooleanEnv("REAL_E2E_CLEANUP", false),
    debug: readBooleanEnv("REAL_E2E_DEBUG", false),
    enabled: readBooleanEnv("REAL_E2E_ENABLED", false),
    headless: readBooleanEnv("REAL_E2E_HEADLESS", true),
    localThemeAssetsFallback: readBooleanEnv(
      "REAL_E2E_LOCAL_THEME_ASSET_FALLBACK",
      false,
    ),
    plan: readEnv("PROMOPULSE_REAL_E2E_PLAN", "PRO"),
    productHandle: readEnv("REAL_E2E_PRODUCT_HANDLE"),
    shopDomain: readEnv("SHOPIFY_SHOP_DOMAIN"),
    storefrontPassword: readEnv("SHOPIFY_STOREFRONT_PASSWORD"),
    storefrontUrl: trimTrailingSlash(readEnv("SHOPIFY_STOREFRONT_URL")),
    storageStatePath: readEnv(
      "REAL_E2E_STORAGE_STATE",
      "playwright/.auth/shopify-admin.json",
    ),
    themeAssetsDir: readEnv(
      "REAL_E2E_THEME_ASSETS_DIR",
      "extensions/counterpulse-theme/assets",
    ),
    themeName: readEnv("REAL_E2E_THEME_NAME"),
    timeoutMs: readNumberEnv("REAL_E2E_TIMEOUT_MS", 90_000),
  };
}

export function requireRealE2E() {
  const config = getConfig();
  const missing = getMissingRequiredEnv();

  if (!config.enabled) {
    throw new Error(
      "Real-store E2E is disabled. Set REAL_E2E_ENABLED=true to run this suite.",
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required real-store E2E env vars: ${missing.join(", ")}.`,
    );
  }

  return config;
}

export function getMissingRequiredEnv() {
  const config = getConfig();

  if (!config.enabled) return [];

  return REQUIRED_WHEN_ENABLED.filter((key) => !readEnv(key));
}

export function storageStateAbsolutePath() {
  return path.resolve(process.cwd(), getConfig().storageStatePath);
}

export function skipIfRealE2EDisabled(test: TestType<object, object>) {
  const config = getConfig();
  test.skip(
    !config.enabled,
    "Set REAL_E2E_ENABLED=true in .env.real-e2e or the shell to run real-store E2E tests.",
  );
}

export function skipIfMissingRequiredEnv(test: TestType<object, object>) {
  const missing = getMissingRequiredEnv();
  test.skip(
    missing.length > 0,
    `Missing required real-store E2E env vars: ${missing.join(", ")}.`,
  );
}

export function uniqueName(label: string) {
  return `${E2E_PREFIX} ${label} ${new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14)}`;
}

export function e2eProductTitle() {
  return `${E2E_PREFIX} Test Product`;
}

export function e2eCollectionTitle() {
  return `${E2E_PREFIX} Collection`;
}

function readEnv(key: string, fallback = "") {
  const value = process.env[key];
  return value === undefined ? fallback : value.trim();
}

function readBooleanEnv(key: string, fallback: boolean) {
  const value = readEnv(key);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readNumberEnv(key: string, fallback: number) {
  const value = Number(readEnv(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
