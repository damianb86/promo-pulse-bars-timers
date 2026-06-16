import { readFile, writeFile } from "node:fs/promises";

import { transformWithEsbuild } from "vite";

const assets = [
  "promo-pilot",
  "product-timer",
  "cart-timer",
  "free-shipping",
  "delivery-cutoff",
  "low-stock",
  "product-badge",
  "discount-code",
];

for (const name of assets) {
  const source = await readFile(
    `theme-extension-src/counterpulse-theme/${name}.js`,
    "utf8",
  );
  const result = await transformWithEsbuild(source, `${name}.js`, {
    legalComments: "none",
    minify: true,
    target: "es2020",
  });

  await writeFile(
    `extensions/counterpulse-theme/assets/${name}.js`,
    `${result.code}\n`,
  );
}
