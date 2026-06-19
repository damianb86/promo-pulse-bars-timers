import { spawn } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || "file:./e2e.sqlite",
  E2E_TEST_MODE: "true",
  NODE_ENV: "development",
  PORT: process.env.PORT || process.env.E2E_PORT || "31338",
  PROMO_PULSE_DEV_PLAN: process.env.PROMO_PULSE_DEV_PLAN || "PREMIUM",
  PROMOPILOT_DEV_PLAN: process.env.PROMOPILOT_DEV_PLAN || "PREMIUM",
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY || "e2e_test_api_key",
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET || "e2e_test_secret",
  SHOPIFY_APP_URL:
    process.env.SHOPIFY_APP_URL ||
    `http://localhost:${process.env.PORT || process.env.E2E_PORT || "31338"}`,
  SCOPES:
    process.env.SCOPES ||
    "read_products,read_orders,read_discounts,write_discounts,write_pixels,read_customer_events",
};

await run("npm", ["exec", "prisma", "generate"], env);
await run("npm", ["exec", "prisma", "migrate", "deploy"], env);
await run("npm", ["exec", "react-router", "dev"], env, {
  inheritStdio: true,
});

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
