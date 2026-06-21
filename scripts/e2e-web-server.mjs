import { spawn } from "node:child_process";
import fs from "node:fs";

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
const env = {
  ...process.env,
  ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  E2E_TEST_MODE: "true",
  HMR_PORT:
    process.env.HMR_PORT ||
    process.env.E2E_HMR_PORT ||
    String(Number(process.env.PORT || process.env.E2E_PORT || "31338") + 1000),
  APP_ENV: appEnv,
  NODE_ENV: nodeEnv,
  PORT: process.env.PORT || process.env.E2E_PORT || "31338",
  PROMO_PULSE_DEV_PLAN: process.env.PROMO_PULSE_DEV_PLAN || "AGENCY",
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY || "e2e_test_api_key",
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET || "e2e_test_secret",
  SHOPIFY_APP_URL:
    process.env.SHOPIFY_APP_URL ||
    `http://localhost:${process.env.PORT || process.env.E2E_PORT || "31338"}`,
  SCOPES:
    process.env.SCOPES ||
    "read_products,read_orders,read_discounts,write_discounts,write_pixels,read_customer_events,read_markets,write_markets",
};

await run("node", ["scripts/prisma-env.mjs", "setup"], env);
await run(
  "node",
  ["scripts/prisma-env.mjs", "exec", "npm", "exec", "react-router", "dev"],
  env,
  {
    inheritStdio: true,
  },
);

function run(command, args, childEnv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: childEnv,
      shell: false,
      stdio: options.inheritStdio ? "inherit" : "pipe",
    });

    let output = "";

    if (!options.inheritStdio) {
      child.stdout.on("data", (chunk) => {
        output += chunk;
        process.stdout.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
        process.stderr.write(chunk);
      });
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed with code ${code}\n${output}`,
          ),
        );
      }
    });
  });
}

function readEnvFile(path) {
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
      .filter(Boolean),
  );
}
