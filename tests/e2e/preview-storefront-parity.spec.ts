import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Verifies that the admin editor preview and the real storefront render a
// campaign with EXACTLY the same computed styles for the properties the
// merchant configures (colors, sizes, spacing, radius). Both renderers build
// the same .counterpulse-preview-* skeleton from the same design values; any
// drift between the dashboard CSS/var builder and the storefront surface
// builder shows up here as a concrete style mismatch.

const STYLE_PROPS = [
  "backgroundColor",
  "backgroundImage",
  "color",
  "fontSize",
  "borderRadius",
  "borderTopWidth",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
] as const;

type StyleSnapshot = Record<string, Record<string, string>>;

// Captures the computed styles of the campaign surface and its key children
// inside `scope` (storefront page or admin preview panel).
async function captureSurfaceStyles(
  scope: ReturnType<Page["locator"]>,
): Promise<StyleSnapshot> {
  const root = scope.locator(".counterpulse-preview-promo").first();
  await expect(root).toBeVisible({ timeout: 20_000 });

  return root.evaluate((surface, props) => {
    const snapshot: Record<string, Record<string, string>> = {};
    const capture = (key: string, element: Element | null) => {
      if (!element) return;
      const style = getComputedStyle(element);
      snapshot[key] = {};
      for (const prop of props) {
        snapshot[key][prop] = style[prop as keyof CSSStyleDeclaration] as string;
      }
    };

    capture("surface", surface);
    capture(
      "headline",
      surface.querySelector(".counterpulse-preview-message-copy strong"),
    );
    capture(
      "body",
      surface.querySelector(".counterpulse-preview-message-copy span"),
    );
    capture("timer", surface.querySelector(".counterpulse-preview-timer"));
    capture(
      "timerUnit",
      surface.querySelector(".counterpulse-preview-timer-unit"),
    );
    capture("cta", surface.querySelector(".counterpulse-preview-cta"));

    return snapshot;
  }, STYLE_PROPS as unknown as string[]);
}

test("storefront renders a campaign with exactly the preview's computed styles", async ({
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("countdown");

  // 1. Real storefront render.
  await page.goto("/__test/storefront");
  const storefront = await captureSurfaceStyles(page.locator("body"));

  // 2. Admin editor preview of the same campaign.
  await loginAsDemoShop("/app/campaigns");
  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  await page.getByRole("tab", { name: "Design" }).click();
  const preview = await captureSurfaceStyles(
    page.locator(".counterpulse-design-editor__preview"),
  );

  // 3. Every element captured in both renders must match exactly.
  const sharedKeys = Object.keys(storefront).filter((key) => preview[key]);
  expect(sharedKeys).toContain("surface");
  expect(sharedKeys).toContain("headline");
  expect(sharedKeys).toContain("timer");

  const mismatches: string[] = [];
  for (const key of sharedKeys) {
    for (const prop of STYLE_PROPS) {
      const storefrontValue = storefront[key][prop];
      const previewValue = preview[key][prop];
      if (storefrontValue !== previewValue) {
        mismatches.push(
          `${key}.${prop}: storefront=${storefrontValue} preview=${previewValue}`,
        );
      }
    }
  }

  expect(mismatches, mismatches.join("\n")).toEqual([]);
});
