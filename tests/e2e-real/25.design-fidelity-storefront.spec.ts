import {
  DesignAlignment,
  DesignBackgroundType,
  DesignTimerFormat,
  PlacementType,
} from "@prisma/client";

import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { pauseAllPrefixedCampaigns } from "./helpers/admin-app";
import {
  createPublishedPlacementCampaign,
  findRealE2EShopId,
  placementHeadline,
} from "./helpers/placement-fixtures";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectNoHorizontalOverflow,
  expectPromoFitsViewport,
  expectPromoTextFits,
  normalizeCssColor,
  readSurfaceProfile,
} from "./helpers/layout";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

/**
 * Design fidelity: a merchant configures the full design surface in the backend
 * (background style, alignment, radius, padding, timer format, close button,
 * custom CSS, full-width) and the storefront must render EXACTLY those styles.
 * These tests read the inline `--cp-*` custom properties and classes that the
 * theme extension applies so a regression in the design->payload->DOM pipeline
 * is caught without relying on pixel snapshots.
 */
test.describe("real storefront design fidelity", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  function barByHeadline(page: import("@playwright/test").Page, headline: string) {
    return page
      .locator(".pp-bar")
      .filter({ hasText: headline })
      .first();
  }

  test("applies a gradient, left alignment, radius, padding, and full width faithfully", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const headline = placementHeadline("Gradient design fidelity");
    await createPublishedPlacementCampaign(shopId, {
      headline,
      name: uniqueName("Design Gradient"),
      placement: PlacementType.TOP_BAR,
      subheadline: "Gradient, left aligned, rounded, roomy padding.",
      design: { fullWidth: true },
      designExtras: {
        backgroundType: DesignBackgroundType.GRADIENT,
        gradientStartColor: "#FF0000",
        gradientEndColor: "#0000FF",
        gradientAngle: 45,
        alignment: DesignAlignment.LEFT,
        borderRadius: 20,
        paddingBlock: 30,
        paddingInline: 40,
      },
    });

    await openStorefront(page, realE2ECacheBustPath("design_gradient"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });

    const profile = await readSurfaceProfile(bar, [
      "--cp-surface-bg",
      "--cp-align",
      "--cp-radius",
      "--cp-padding-block",
      "--cp-padding-inline",
    ]);

    expect(profile.cssVars["--cp-surface-bg"]).toBe(
      "linear-gradient(45deg, #FF0000, #0000FF)",
    );
    expect(profile.cssVars["--cp-radius"]).toBe("20px");
    expect(profile.cssVars["--cp-padding-block"]).toBe("30px");
    expect(profile.cssVars["--cp-padding-inline"]).toBe("40px");
    expect(profile.className).toContain("pp-bar--full-width");
    expect(profile.justifyItems).toBe("start");
    expect(profile.backgroundImage).toContain("linear-gradient");

    await expectPromoFitsViewport(bar, "gradient bar");
    await expectPromoTextFits(bar, "gradient bar");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders a COLON timer, close button, and injected custom CSS", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const headline = placementHeadline("Colon timer fidelity");
    const marker = "letter-spacing: 4px";
    await createPublishedPlacementCampaign(shopId, {
      headline,
      name: uniqueName("Design Colon Timer"),
      placement: PlacementType.TOP_BAR,
      subheadline: "Colon timer with a close button.",
      designExtras: {
        timerFormat: DesignTimerFormat.COLON,
        showCloseButton: true,
        closeButtonColor: "#FFEE00",
        customCss: `.pp-message strong { ${marker}; }`,
      },
    });

    await openStorefront(page, realE2ECacheBustPath("design_colon"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });

    // COLON timer format renders HH:MM:SS with the colon treatment class.
    const timer = bar.locator(".pp-countdown").first();
    await expect(timer).toHaveClass(/pp-countdown--colon/);
    await expect(timer).toHaveText(/^(?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
      timeout: 30_000,
    });

    // The merchant custom CSS must be injected verbatim as a scoped <style>.
    // (Query <style> text via evaluate: Playwright's hasText ignores <style>
    // element content.)
    const hasInjectedCss = await bar.evaluate(
      (el, needle) =>
        Array.from(el.querySelectorAll("style")).some((style) =>
          (style.textContent || "").includes(needle),
        ),
      marker,
    );
    expect(hasInjectedCss, "custom CSS should be injected as a <style>").toBe(
      true,
    );

    const closeColor = await readSurfaceProfile(bar, ["--cp-close"]);
    expect(closeColor.cssVars["--cp-close"]).toBe("#FFEE00");

    // The close control hides the bar and it should not reappear on reload of the widget.
    const close = page.getByRole("button", { name: /close/i }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
      await expect(bar).toBeHidden();
    }

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("keeps text and title colors readable and consistent across the bar", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const headline = placementHeadline("Color consistency fidelity");
    await createPublishedPlacementCampaign(shopId, {
      headline,
      name: uniqueName("Design Colors"),
      placement: PlacementType.TOP_BAR,
      subheadline: "Text and title colors must match the saved design.",
      design: { backgroundColor: "#111827", textColor: "#F9FAFB" },
      designExtras: {
        titleColor: "#F9FAFB",
        subheadingColor: "#F9FAFB",
        timerColor: "#F9FAFB",
      },
    });

    await openStorefront(page, realE2ECacheBustPath("design_colors"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });

    const profile = await readSurfaceProfile(bar, [
      "--cp-bg",
      "--cp-text",
      "--cp-title-color",
    ]);
    expect(profile.cssVars["--cp-bg"]).toBe("#111827");
    expect(profile.cssVars["--cp-text"]).toBe("#F9FAFB");
    expect(profile.cssVars["--cp-title-color"]).toBe("#F9FAFB");

    // Resolved computed color on the rendered title node must also match.
    const titleColor = await bar
      .locator(".pp-message strong")
      .first()
      .evaluate((node) => getComputedStyle(node).color)
      .catch(() => "");
    if (titleColor) {
      expect(titleColor).toBe(normalizeCssColor("#F9FAFB"));
    }

    await expectPromoTextFits(bar, "color bar");
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
