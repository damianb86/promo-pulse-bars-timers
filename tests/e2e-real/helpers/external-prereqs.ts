import dns from "node:dns/promises";

import type { TestInfo } from "@playwright/test";

import { getConfig } from "./env";

type Reachability = {
  ok: boolean;
  message: string;
};

let appBackendReachability: Promise<Reachability> | undefined;

export async function skipIfAppBackendUnavailable(testInfo: TestInfo) {
  const config = getConfig();

  if (!config.enabled || testCanRunWithoutAppBackend(testInfo)) return;

  const reachability = await getAppBackendReachability();

  testInfo.skip(!reachability.ok, reachability.message);
}

async function getAppBackendReachability() {
  if (!appBackendReachability) {
    appBackendReachability = checkAppBackendReachability();
  }

  return appBackendReachability;
}

async function checkAppBackendReachability(): Promise<Reachability> {
  const config = getConfig();
  const appUrl = safeUrl(config.appAdminUrl);

  if (!appUrl) {
    return {
      ok: false,
      message:
        "Set PROMO_PULSE_APP_ADMIN_URL to the current Shopify CLI app URL before running real E2E tests.",
    };
  }

  try {
    await dns.lookup(appUrl.hostname);
  } catch {
    return {
      ok: false,
      message: `External prerequisite missing: PROMO_PULSE_APP_ADMIN_URL (${appUrl.origin}) does not resolve. Restart shopify app dev and copy the current trycloudflare URL into .env.real-e2e.`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(appUrl.origin, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 500) {
      return {
        ok: false,
        message: `External prerequisite missing: PROMO_PULSE_APP_ADMIN_URL (${appUrl.origin}) returned HTTP ${response.status}. Restart shopify app dev or update .env.real-e2e to the current tunnel URL.`,
      };
    }

    return { ok: true, message: "" };
  } catch {
    return {
      ok: false,
      message: `External prerequisite missing: PROMO_PULSE_APP_ADMIN_URL (${appUrl.origin}) is not reachable. Restart shopify app dev or update .env.real-e2e to the current tunnel URL.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function testCanRunWithoutAppBackend(testInfo: TestInfo) {
  const title = testInfo.titlePath.join(" ");

  return (
    title.includes("REAL_E2E_ENABLED and required env are configured") ||
    title.includes("storageState exists") ||
    title.includes("Shopify admin opens with storageState")
  );
}

function safeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
