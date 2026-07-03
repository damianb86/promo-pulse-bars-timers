import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { getAppFrameOrPage, openPromoPulseApp } from "./helpers/auth";
import {
  pauseAllPrefixedCampaigns,
  publishCampaignDraft,
} from "./helpers/admin-app";
import { expectNoConsoleErrors } from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

// End-to-end quality check for AI-generated campaigns on a real store: the
// generated campaign must render professionally on the live storefront — the
// surface exists, its copy is present, its text is legible against its real
// computed background, and it never pins itself over the host page. This is
// the real-store counterpart of the structure guardrail unit/e2e tests: it
// validates the AI output AFTER the theme, app embed, and real CSS cascade
// have all had their say.

test.describe("real AI campaign storefront quality", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("AI-generated campaign renders legibly on the real storefront", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);

    await pauseAllPrefixedCampaigns(page);
    await openPromoPulseApp(page, "/app/campaigns/new");
    const app = await getAppFrameOrPage(page);

    const aiButton = app.getByRole("button", { name: "AI campaign" });
    testInfo.skip(
      !(await aiButton.isVisible().catch(() => false)),
      "AI campaign builder is not available on this store/plan.",
    );
    await aiButton.click();

    const aiBuilder = app.locator(".counterpulse-ai-builder");
    const eventName = uniqueName("AI Quality");
    await aiBuilder
      .getByLabel("Product, collection, or audience")
      .fill("best sellers");
    await aiBuilder.getByLabel("Event or season").first().fill(eventName);
    await aiBuilder.getByLabel("Offer details").fill("15% off");
    await aiBuilder.getByRole("button", { name: "Generate with AI" }).click();

    // A real provider (OpenAI) can take a while; follow-up questions may also
    // appear first — answer through them if so.
    const followUps = app.getByRole("button", {
      name: "Generate campaign with these answers",
    });
    const preview = app.getByText("AI suggestion preview");
    await expect(preview.or(followUps).first()).toBeVisible({
      timeout: 120_000,
    });
    if (await followUps.isVisible().catch(() => false)) {
      await followUps.click();
    }
    await expect(preview).toBeVisible({ timeout: 120_000 });

    await app.getByRole("button", { name: "Apply suggestion" }).click();
    await app.locator('select[name="status"]').selectOption("ACTIVE");
    await app.getByRole("button", { name: "Save campaign" }).click();
    const confirmDialog = page
      .getByRole("dialog")
      .filter({ hasText: /save campaign/i });
    if (await confirmDialog.isVisible().catch(() => false)) {
      await confirmDialog.getByRole("button", { name: /save/i }).click();
    }
    await page.waitForURL(/\/app\/campaigns\/(?!new)[^/?]+/, {
      timeout: 60_000,
    });
    await publishCampaignDraft(page);

    await openStorefront(page, realE2ECacheBustPath("ai-quality"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const surface = page
      .locator('[data-testid="promo-bar"], .pp-bar, .cp-promo')
      .first();
    await expect(surface).toBeVisible({ timeout: 30_000 });

    const quality = await surface.evaluate((element) => {
      const parseColor = (value: string) => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        const [r, g, b, a = "1"] = match[1].split(",").map((p) => p.trim());
        return {
          r: Number(r),
          g: Number(g),
          b: Number(b),
          a: Number(a),
        };
      };
      const luminance = (c: { r: number; g: number; b: number }) => {
        const lin = (v: number) => {
          const n = v / 255;
          return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      };

      // Effective background: walk up until a non-transparent background.
      let node: Element | null = element;
      let background = null;
      while (node && !background) {
        const parsed = parseColor(getComputedStyle(node).backgroundColor);
        if (parsed && parsed.a > 0.1) background = parsed;
        node = node.parentElement;
      }

      const text = parseColor(getComputedStyle(element).color);
      let contrast = null;
      if (text && background) {
        const lighter = Math.max(luminance(text), luminance(background));
        const darker = Math.min(luminance(text), luminance(background));
        contrast = (lighter + 0.05) / (darker + 0.05);
      }

      // No element of the campaign may pin itself over the host page.
      const pinned = [element, ...element.querySelectorAll("*")].some(
        (el) => getComputedStyle(el).position === "fixed",
      );

      const rect = element.getBoundingClientRect();

      return {
        contrast,
        pinned,
        width: rect.width,
        height: rect.height,
        textLength: (element.textContent ?? "").trim().length,
      };
    });

    // The campaign has real dimensions and real copy.
    expect(quality.width).toBeGreaterThan(120);
    expect(quality.height).toBeGreaterThan(16);
    expect(quality.textLength).toBeGreaterThan(10);
    // The AI CSS never pins the campaign over the merchant's page.
    expect(quality.pinned).toBe(false);
    // Legibility floor: computed text vs effective background. Lenient (3:1)
    // because real themes may layer scrims/gradients the simple walk misses.
    if (quality.contrast !== null) {
      expect(quality.contrast).toBeGreaterThanOrEqual(3);
    }

    await expectNoConsoleErrors(page);
    await pauseAllPrefixedCampaigns(page);
  });
});
