import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

// Regression: a merchant/AI custom structure carries plain (non-slot) elements
// and inline styles. The storefront normalizes the campaign design twice (once
// in the fetch broker, once inside build()); a non-idempotent packed-AST decode
// used to drop the whole custom structure on the second pass, silently falling
// back to the generated layout and losing the custom <h3> + CTA style.
test("storefront renders custom structure elements and inline styles verbatim", async ({
  page,
  resetDb,
}) => {
  await resetDb("countdown-custom-structure");
  await page.goto("/__test/storefront");

  const bar = page.locator(".pp-bar").first();
  await expect(bar).toBeVisible();

  // The plain <h3> the merchant added (not a data-cp-slot) must render, with its
  // inline style intact.
  const heading = bar.locator("h3");
  await expect(heading).toHaveText("ARGENTINA BEY");
  await expect(heading).toHaveCSS("text-align", "right");

  // Every inline-style declaration set on the CTA slot placeholder (via the
  // component inspector's Custom CSS panel) must survive hydration and apply on
  // the storefront — not just some of them.
  const cta = bar.locator(".counterpulse-preview-actions a").first();
  await expect(cta).toHaveCSS("height", "200px");
  await expect(cta).toHaveCSS("display", "flex");
  await expect(cta).toHaveCSS("align-items", "center");
  await expect(cta).toHaveCSS("padding", "0px 30px");
  await expect(cta).toHaveCSS("font-size", "25px");

  // The button must keep its base look: even though the merchant only overrode a
  // few properties via Custom CSS, the shared cta class still supplies the design
  // background/text color (a slot placeholder carries no class of its own).
  await expect(cta).toHaveClass(/counterpulse-preview-cta/);
  await expect(cta).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
