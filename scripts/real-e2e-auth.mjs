import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "@playwright/test";

loadEnvFile(".env.real-e2e");

const adminUrl = readEnv("SHOPIFY_ADMIN_URL");
const authBrowser = readEnv("REAL_E2E_AUTH_BROWSER", "chrome");
const storageStatePath = path.resolve(
  process.cwd(),
  readEnv("REAL_E2E_STORAGE_STATE", "playwright/.auth/shopify-admin.json"),
);
const userDataDir = path.resolve(
  process.cwd(),
  readEnv(
    "REAL_E2E_AUTH_PROFILE_DIR",
    "playwright/.auth/shopify-admin-profile",
  ),
);

if (!adminUrl) {
  console.error(
    "SHOPIFY_ADMIN_URL is required. Add it to .env.real-e2e before running auth.",
  );
  process.exit(1);
}

const context = await launchAuthContext();
const page = await context.newPage();

await page.goto(adminUrl, { waitUntil: "domcontentloaded" });

console.log("");
console.log("A browser window is open for Shopify Admin authentication.");
console.log("Finish the Shopify login manually and wait until the admin loads.");
console.log(`Target admin URL: ${adminUrl}`);
console.log(`Browser: ${authBrowser}`);
console.log(`Persistent profile: ${userDataDir}`);
console.log("");

const rl = readline.createInterface({ input, output });
await rl.question(
  "Press Enter here after Shopify Admin is visible in the browser...",
);
rl.close();

await fs.promises.mkdir(path.dirname(storageStatePath), { recursive: true });
await context.storageState({ path: storageStatePath });
await context.close();

console.log(`Saved Playwright storageState to ${storageStatePath}`);

async function launchAuthContext() {
  await fs.promises.mkdir(userDataDir, { recursive: true });

  try {
    return await chromium.launchPersistentContext(userDataDir, {
      channel: authBrowser === "chromium" ? undefined : authBrowser,
      headless: false,
      viewport: null,
    });
  } catch (error) {
    if (authBrowser === "chromium") throw error;

    console.warn(
      `Could not launch ${authBrowser}; falling back to Playwright Chromium.`,
    );
    console.warn(error instanceof Error ? error.message : String(error));

    return chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: null,
    });
  }
}

function loadEnvFile(envPath) {
  const resolved = path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(resolved)) return;

  const content = fs.readFileSync(resolved, "utf8");
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

function readEnv(key, fallback = "") {
  const value = process.env[key];
  return value === undefined ? fallback : value.trim();
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
