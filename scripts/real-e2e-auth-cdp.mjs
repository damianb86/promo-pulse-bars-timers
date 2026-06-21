import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "@playwright/test";

loadEnvFile(".env.real-e2e");

const adminUrl = readEnv("SHOPIFY_ADMIN_URL");
const cdpUrl = readEnv("REAL_E2E_CDP_URL", "http://127.0.0.1:9222");
const storageStatePath = path.resolve(
  process.cwd(),
  readEnv("REAL_E2E_STORAGE_STATE", "playwright/.auth/shopify-admin.json"),
);

if (!adminUrl) {
  console.error(
    "SHOPIFY_ADMIN_URL is required. Add it to .env.real-e2e before running auth.",
  );
  process.exit(1);
}

console.log("");
console.log("This auth flow connects to a Chrome window that you launch manually.");
console.log("Start Chrome with remote debugging before continuing:");
console.log("");
console.log(
  '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.promo-pulse-real-e2e-chrome"',
);
console.log("");
console.log(`Then open or let this script open: ${adminUrl}`);
console.log("");

const rl = readline.createInterface({ input, output });
await rl.question("Press Enter after Chrome is running with remote debugging...");

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());

await page.goto(adminUrl, { waitUntil: "domcontentloaded" });

console.log("");
console.log("Finish Shopify login manually in that Chrome window.");
console.log("Wait until Shopify Admin is visible.");
console.log("");

await rl.question("Press Enter here after Shopify Admin is visible...");
rl.close();

await fs.promises.mkdir(path.dirname(storageStatePath), { recursive: true });
await context.storageState({ path: storageStatePath });
await browser.close();

console.log(`Saved Playwright storageState to ${storageStatePath}`);

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
