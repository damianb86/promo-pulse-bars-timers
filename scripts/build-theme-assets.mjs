import { readFile, writeFile } from "node:fs/promises";

import { transformWithEsbuild } from "vite";

const assets = [
  "campaign-surface",
  "campaign-loader",
  "promo-pulse",
  "product-timer",
  "cart-timer",
  "free-shipping",
  "delivery-cutoff",
  "low-stock",
  "product-badge",
  "discount-code",
];

// Plain CSS assets are copied verbatim (the build only minifies JS).
const cssAssets = ["campaign-surface", "campaign-surface-critical"];

for (const name of assets) {
  const source = await readFile(
    `theme-extension-src/promo-pulse-theme/${name}.js`,
    "utf8",
  );
  const result = await transformWithEsbuild(source, `${name}.js`, {
    legalComments: "none",
    minify: true,
    target: "es2020",
  });

  await writeFile(
    `extensions/promo-pulse-theme/assets/${name}.js`,
    `/* eslint-disable */\n${result.code.trimEnd()}\n`,
  );
}

for (const name of cssAssets) {
  const source = await readFile(
    `theme-extension-src/promo-pulse-theme/${name}.css`,
    "utf8",
  );

  await writeFile(
    `extensions/promo-pulse-theme/assets/${name}.css`,
    source.trimEnd() + "\n",
  );
}
