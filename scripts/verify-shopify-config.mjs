import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve("shopify.app.toml");
const config = fs.readFileSync(configPath, "utf8");

const applicationUrl = readTomlString(config, "application_url");
const redirectUrls = readTomlStringArray(config, "redirect_urls");
const errors = [];

if (!applicationUrl) {
  errors.push("shopify.app.toml is missing application_url.");
}

if (applicationUrl?.includes("shopify.dev/apps/default-app-home")) {
  errors.push(
    "application_url still points to Shopify's default-app-home placeholder.",
  );
}

if (!applicationUrl?.startsWith("https://")) {
  errors.push("application_url must be an HTTPS URL for Shopify Admin.");
}

if (redirectUrls.length === 0) {
  errors.push("shopify.app.toml is missing auth.redirect_urls.");
}

for (const redirectUrl of redirectUrls) {
  if (redirectUrl.includes("shopify.dev/apps/default-app-home")) {
    errors.push(
      `redirect_urls contains Shopify's default placeholder: ${redirectUrl}`,
    );
  }

  if (!redirectUrl.endsWith("/auth/callback")) {
    errors.push(
      `redirect URL should end with /auth/callback for this React Router template: ${redirectUrl}`,
    );
  }
}

if (errors.length > 0) {
  console.error("Shopify app config is not ready for dev store testing:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  console.error(
    "\nRun `npm run config:link` and then `npm run dev` so Shopify CLI can write the current HTTPS tunnel URL to the linked app config.",
  );
  process.exit(1);
}

console.log("Shopify app config points to a non-placeholder app home URL.");

function readTomlString(source, key) {
  const match = source.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));

  return match?.[1] ?? "";
}

function readTomlStringArray(source, key) {
  const match = source.match(new RegExp(`^${key}\\s*=\\s*\\[(.*?)\\]`, "ms"));

  if (!match) return [];

  return Array.from(match[1].matchAll(/"([^"]*)"/g)).map((item) => item[1]);
}
