import type { Locator, Page } from "@playwright/test";

import { expect } from "./fixtures";
import type { PlacementFixtureDesign } from "./placement-fixtures";

type PlacementPosition =
  | "BOTTOM_BAR"
  | "CART_DRAWER"
  | "CART_PAGE"
  | "COLLECTION_CARD"
  | "CUSTOM_SELECTOR"
  | "PRODUCT_PAGE"
  | "PRODUCT_PAGE_BADGE"
  | "TOP_BAR";

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;

    return (
      Math.max(root.scrollWidth, body?.scrollWidth ?? 0) - window.innerWidth
    );
  });

  expect(
    overflow,
    "storefront should not horizontally overflow",
  ).toBeLessThanOrEqual(2);
}

export async function expectPromoFitsViewport(locator: Locator, label: string) {
  const box = await locator.boundingBox();

  expect(box, `${label} should have a rendered bounding box`).not.toBeNull();
  if (!box) return;

  expect(box.width, `${label} should have width`).toBeGreaterThan(0);
  expect(box.height, `${label} should have height`).toBeGreaterThan(0);
  expect(box.x, `${label} should not overflow left`).toBeGreaterThanOrEqual(-1);
}

export async function expectPromoTextFits(locator: Locator, label: string) {
  const overflowingText = await locator.evaluateAll((elements) =>
    elements.flatMap((element) =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          ".pp-message, .pp-message-copy, .pp-cta, .pp-code, .pp-unique-code, .pp-badge-text",
        ),
      )
        .filter((child) => child.scrollWidth - child.clientWidth > 2)
        .map((child) => child.textContent?.trim() || child.className),
    ),
  );

  expect(overflowingText, `${label} text should fit`).toEqual([]);
}

export async function expectPlacementPosition(
  page: Page,
  locator: Locator,
  placement: PlacementPosition,
) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box, `${placement} should be rendered`).not.toBeNull();
  if (!box || !viewport) return;

  if (placement === "TOP_BAR") {
    expect(
      box.y,
      "top bar should render near the top of the document",
    ).toBeLessThan(Math.max(220, viewport.height * 0.35));
  }

  if (placement === "BOTTOM_BAR") {
    const order = await page.locator("#pp-bottom-bars").evaluate((element) => {
      const bodyChildren = Array.from(document.body.children);
      return {
        index: bodyChildren.indexOf(element),
        total: bodyChildren.length,
      };
    });

    expect(
      order.index,
      "bottom bar container should be appended late in the body",
    ).toBeGreaterThanOrEqual(Math.max(0, order.total - 6));
  }

  if (placement === "CUSTOM_SELECTOR") {
    const isInsideTarget = await locator.evaluate((element) =>
      Boolean(element.closest(".pp-e2e-custom-target")),
    );

    expect(isInsideTarget, "custom selector should render inside target").toBe(
      true,
    );
  }

  if (placement === "CART_DRAWER") {
    expect(
      box.x + box.width,
      "cart drawer widget should stay within the viewport width",
    ).toBeLessThanOrEqual(viewport.width + 2);
  }
}

export async function expectPublishedDesignApplied(
  locator: Locator,
  design: PlacementFixtureDesign,
  label: string,
) {
  const actual = await locator.evaluate((element) => {
    const target = element as HTMLElement;
    const style = getComputedStyle(target);
    const title = target.querySelector<HTMLElement>(
      ".pp-message strong, .pp-badge-text",
    );
    const timer = target.querySelector<HTMLElement>(
      '[data-testid="promo-timer"], .pp-countdown',
    );

    return {
      backgroundColor: style.backgroundColor,
      className: target.className,
      color: style.color,
      titleColor: title ? getComputedStyle(title).color : "",
      timerClassName: timer?.className ?? "",
    };
  });

  expect(actual.className, `${label} should preserve layout class`).toContain(
    design.layoutClass,
  );
  expect(actual.backgroundColor, `${label} should preserve background`).toBe(
    hexToRgb(design.backgroundColor),
  );
  expect(actual.color, `${label} should preserve text color`).toBe(
    hexToRgb(design.textColor),
  );
  if (actual.titleColor) {
    expect(actual.titleColor, `${label} should preserve title color`).toBe(
      hexToRgb(design.textColor),
    );
  }
  if (actual.timerClassName) {
    expect(
      actual.timerClassName,
      `${label} should preserve timer treatment`,
    ).toContain(design.timerClass);
  }
}

/**
 * Reads the rendered surface profile of a promo element: the class list, the
 * `--cp-*` CSS custom properties the theme extension applies inline, and a few
 * resolved computed styles. Used by the design-fidelity spec to prove that the
 * campaign design saved in the backend is faithfully applied on the storefront.
 */
export async function readSurfaceProfile(locator: Locator, vars: string[]) {
  return locator.evaluate(
    (element, keys) => {
      const target = element as HTMLElement;
      const computed = getComputedStyle(target);
      const cssVars: Record<string, string> = {};

      for (const key of keys as string[]) {
        cssVars[key] = target.style.getPropertyValue(key).trim();
      }

      return {
        className: target.className,
        cssVars,
        backgroundImage: computed.backgroundImage,
        justifyItems: computed.justifyItems,
        textAlign: computed.textAlign,
        borderTopLeftRadius: computed.borderTopLeftRadius,
      };
    },
    vars,
  );
}

export function normalizeCssColor(hex: string) {
  return hexToRgb(hex);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}
