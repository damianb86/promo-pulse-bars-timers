/* eslint-env node */

import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve("shopify.app.toml");
const envPath = path.resolve(".env");
const dryRun = process.argv.includes("--dry-run");
const source = fs.readFileSync(configPath, "utf8");
const currentApplicationUrl = readTomlString(source, "application_url");
const explicitUrl =
  readArgValue("--url") ||
  process.env.SHOPIFY_APP_URL ||
  readDotEnvValue(envPath, "SHOPIFY_APP_URL");
const applicationUrl = normalizeApplicationUrl(
  explicitUrl || currentApplicationUrl,
);

if (
  !applicationUrl ||
  applicationUrl.includes("shopify.dev/apps/default-app-home")
) {
  console.error(
    [
      "SHOPIFY_APP_URL must be set to the deployed Promo Pulse web app URL before deploy.",
      "",
      "Example:",
      "  SHOPIFY_APP_URL=https://promo-pulse.example.com npm run deploy",
      "",
      "This value is used for:",
      "  application_url",
      "  auth.redirect_urls",
      "  app_proxy.url",
    ].join("\n"),
  );
  process.exit(1);
}

const redirectUrl = `${applicationUrl}/auth/callback`;
const appProxyUrl = `${applicationUrl}/apps/promo-pulse`;
const next = updateSectionKey(
  updateSectionKey(
    updateTopLevelKey(source, "application_url", applicationUrl),
    "auth",
    "redirect_urls",
    `[ "${redirectUrl}" ]`,
  ),
  "app_proxy",
  "url",
  `"${appProxyUrl}"`,
);

if (next === source) {
  console.log("shopify.app.toml already points to the deployed app URL.");
} else if (dryRun) {
  console.log("shopify.app.toml would be updated with:");
  console.log(`- application_url = "${applicationUrl}"`);
  console.log(`- redirect_urls = [ "${redirectUrl}" ]`);
  console.log(`- [app_proxy].url = "${appProxyUrl}"`);
} else {
  fs.writeFileSync(configPath, next);
  console.log("shopify.app.toml updated with deployed app URLs:");
  console.log(`- application_url = "${applicationUrl}"`);
  console.log(`- redirect_urls = [ "${redirectUrl}" ]`);
  console.log(`- [app_proxy].url = "${appProxyUrl}"`);
}

function readArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));

  return match ? match.slice(prefix.length).trim() : "";
}

function readDotEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return "";

  const env = fs.readFileSync(filePath, "utf8");
  const match = env.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, "m"));
  const value = match?.[1]?.trim() ?? "";

  return value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function normalizeApplicationUrl(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\/+$/, "");

  if (!normalized) return "";

  try {
    const url = new URL(normalized);

    if (url.protocol !== "https:") {
      throw new Error("SHOPIFY_APP_URL must use https.");
    }

    return url.toString().replace(/\/+$/, "");
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "SHOPIFY_APP_URL must be a valid absolute URL.",
    );
    process.exit(1);
  }
}

function readTomlString(contents, key) {
  const match = contents.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));

  return match?.[1] ?? "";
}

function updateTopLevelKey(contents, key, value) {
  return updateSectionKey(contents, "", key, `"${value}"`);
}

function updateSectionKey(contents, section, key, value) {
  const lines = contents.split("\n");
  let currentSection = "";
  let updated = false;

  const nextLines = lines.map((line) => {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);

    if (sectionMatch) {
      currentSection = sectionMatch[1];
      return line;
    }

    if (currentSection === section && line.match(new RegExp(`^${key}\\s*=`))) {
      updated = true;
      return `${key} = ${value}`;
    }

    return line;
  });

  if (!updated) {
    throw new Error(
      section
        ? `Missing ${key} in [${section}] in shopify.app.toml.`
        : `Missing ${key} in shopify.app.toml.`,
    );
  }

  return nextLines.join("\n");
}
