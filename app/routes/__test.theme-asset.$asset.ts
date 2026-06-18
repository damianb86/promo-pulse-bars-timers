import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LoaderFunctionArgs } from "react-router";

import { requireE2ETestMode } from "../services/e2e-test.server";

const allowedAssets = new Set([
  "cart-timer.js",
  "delivery-cutoff.js",
  "discount-code.js",
  "free-shipping.js",
  "low-stock.js",
  "product-badge.js",
  "product-timer.js",
  "promo-pilot.css",
  "promo-pilot.js",
]);

export const loader = async ({ params }: LoaderFunctionArgs) => {
  requireE2ETestMode();

  const asset = params.asset ?? "";

  if (!allowedAssets.has(asset)) {
    throw new Response("Not found", { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "extensions/counterpulse-theme/assets",
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
