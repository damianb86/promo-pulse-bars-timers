import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LoaderFunctionArgs } from "react-router";

import { requireE2ETestMode } from "../services/e2e-test.server";

const allowedAssets = new Set([
  "campaign-surface.css",
  "campaign-surface-critical.css",
  "campaign-surface.js",
  "campaign-loader.js",
  "cart-timer.js",
  "delivery-cutoff.js",
  "discount-code.js",
  "free-shipping.js",
  "low-stock.js",
  "product-badge.js",
  "product-timer.js",
  "promo-pulse.css",
  "promo-pulse.js",
]);

export const loader = async ({ params }: LoaderFunctionArgs) => {
  requireE2ETestMode();

  const asset = params.asset ?? "";

  if (!allowedAssets.has(asset)) {
    throw new Response("Not found", { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "extensions/promo-pulse-theme/assets",
    asset,
  );
  const body = await readFile(filePath);

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": asset.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "application/javascript; charset=utf-8",
    },
  });
};
