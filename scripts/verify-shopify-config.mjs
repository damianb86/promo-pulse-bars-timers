/* eslint-env node */

import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve("shopify.app.toml");
const config = fs.readFileSync(configPath, "utf8");
const webConfigPath = path.resolve("shopify.web.toml");
const strict = process.argv.includes("--strict");

const applicationUrl = readTomlString(config, "application_url");
const redirectUrls = readTomlStringArray(config, "redirect_urls");
const appProxyUrl = readTomlSectionString(config, "app_proxy", "url");
const appProxySubpath = readTomlSectionString(config, "app_proxy", "subpath");
const appProxyPrefix = readTomlSectionString(config, "app_proxy", "prefix");
const webhooksApiVersion = readTomlSectionString(config, "webhooks", "api_version");
const supportedRuntimeApiVersions = new Set([
  "2024-10",
  "2025-01",
  "2025-04",
  "2025-07",
  "2025-10",
  "2026-01",
  "2026-04",
]);
const expectedRedirectUrl = applicationUrl
  ? `${applicationUrl.replace(/\/+$/, "")}/auth/callback`
  : "";
const expectedAppProxyUrl = applicationUrl
  ? `${applicationUrl.replace(/\/+$/, "")}/apps/promo-pulse`
  : "";
const errors = [];
const warnings = [];

if (!applicationUrl) {
  errors.push("shopify.app.toml is missing application_url.");
}

if (applicationUrl?.includes("shopify.dev/apps/default-app-home")) {
  const message =
    "application_url points to Shopify's default-app-home placeholder. This is acceptable for `shopify app dev` only if the dev output shows a generated HTTPS app_home URL.";
  (strict ? errors : warnings).push(message);
}

if (!fs.existsSync(webConfigPath)) {
  errors.push(
    "shopify.web.toml is missing, so Shopify CLI cannot start and tunnel the React Router web app.",
  );
}

if (!applicationUrl?.startsWith("https://")) {
  errors.push("application_url must be an HTTPS URL for Shopify Admin.");
}

if (redirectUrls.length === 0) {
  errors.push("shopify.app.toml is missing auth.redirect_urls.");
}

if (!appProxyUrl || !appProxySubpath || !appProxyPrefix) {
  errors.push(
    "shopify.app.toml is missing [app_proxy] url, subpath, or prefix. Storefront calls to /apps/promo-pulse will redirect to storefront pages instead of the app.",
  );
}

if (appProxyUrl?.includes("shopify.dev/apps/default-app-home")) {
  const message =
    "app_proxy.url points to Shopify's default-app-home placeholder. This is acceptable for `shopify app dev` only if the dev output applies a generated HTTPS tunnel URL to the app proxy.";
  (strict ? errors : warnings).push(message);
}

if (
  expectedAppProxyUrl &&
  !applicationUrl?.includes("shopify.dev/apps/default-app-home") &&
  appProxyUrl !== expectedAppProxyUrl
) {
  const message = `app_proxy.url should be ${expectedAppProxyUrl}, but it is ${appProxyUrl || "(missing)"}. Run \`npm run config:sync-url\` before deploy.`;
  (strict ? errors : warnings).push(message);
}

if (
  appProxyPrefix &&
  !["a", "apps", "community", "tools"].includes(appProxyPrefix)
) {
  errors.push("app_proxy.prefix must be one of: a, apps, community, tools.");
}

if (appProxySubpath && appProxySubpath !== "promo-pulse") {
  warnings.push(
    `app_proxy.subpath is ${appProxySubpath}; storefront assets currently request /apps/promo-pulse.`,
  );
}

if (appProxyUrl?.includes("counterpulse")) {
  errors.push(
    "app_proxy.url still references CounterPulse. It must point to /apps/promo-pulse.",
  );
}

if (appProxySubpath?.includes("counterpulse")) {
  errors.push(
    "app_proxy.subpath still references CounterPulse. It must be promo-pulse.",
  );
}

if (!webhooksApiVersion) {
  errors.push("shopify.app.toml is missing [webhooks].api_version.");
} else if (!supportedRuntimeApiVersions.has(webhooksApiVersion)) {
  errors.push(
    `[webhooks].api_version ${webhooksApiVersion} is not supported by the installed Shopify runtime. Use 2026-04 until dependencies are upgraded.`,
  );
}

for (const redirectUrl of redirectUrls) {
  if (redirectUrl.includes("shopify.dev/apps/default-app-home")) {
    const message = `redirect_urls contains Shopify's default placeholder: ${redirectUrl}`;
    (strict ? errors : warnings).push(message);
  }

  if (redirectUrl.endsWith("/api/auth")) {
    errors.push(
      `redirect URL uses the old /api/auth path; this React Router template expects /auth/callback: ${redirectUrl}`,
    );
  }

  if (!redirectUrl.endsWith("/auth/callback")) {
    errors.push(
      `redirect URL should end with /auth/callback for this React Router template: ${redirectUrl}`,
    );
  }

  if (
    expectedRedirectUrl &&
    !applicationUrl?.includes("shopify.dev/apps/default-app-home") &&
    redirectUrl !== expectedRedirectUrl
  ) {
    const message = `redirect URL should be ${expectedRedirectUrl}, but it is ${redirectUrl}. Run \`npm run config:sync-url\` before deploy.`;
    (strict ? errors : warnings).push(message);
  }
}

if (errors.length > 0) {
  console.error("Shopify app config has blocking issues:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  console.error(
    "\nFix these issues, then run `npm run dev`. The dev output must show `app_home └ Using URL: https://...` with a generated tunnel URL.",
  );
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("Shopify app config warnings:\n");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
  console.warn(
    "\nFor local development, run `npm run dev` and verify the output shows a generated HTTPS app_home URL. For production/release validation, run `npm run config:check -- --strict`.",
  );
}

console.log("Shopify app config has no blocking local development issues.");

function readTomlString(source, key) {
  const match = source.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));

  return match?.[1] ?? "";
}

function readTomlStringArray(source, key) {
  const match = source.match(new RegExp(`^${key}\\s*=\\s*\\[(.*?)\\]`, "ms"));

  if (!match) return [];

  return Array.from(match[1].matchAll(/"([^"]*)"/g)).map((item) => item[1]);
}

function readTomlSectionString(source, section, key) {
  const sectionMatch = source.match(
    new RegExp(`(?:^|\\n)\\[${section}\\]\\s*([\\s\\S]*?)(?=\\n\\[|$)`),
  );

  if (!sectionMatch) return "";

  const valueMatch = sectionMatch[1].match(
    new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"),
  );

  return valueMatch?.[1] ?? "";
}
