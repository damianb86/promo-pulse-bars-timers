import {
  createElement,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import type { CampaignViewModel } from "../utils/campaign-view-model";
import type { CampaignDesignValues } from "../types/campaign-design";
import { sanitizeBasicHtml } from "../utils/basic-html";
import {
  getNodeSlot,
  scopeCustomCss,
  STRUCTURE_BASELINE_CSS,
  TEXT_TAG,
  TIMER_PART_SLOTS,
  timerPartValue,
  type StructureNode,
} from "../utils/campaign-structure";
import {
  customMessageIdFromSlot,
  type CustomMessage,
} from "../utils/custom-messages";
import type { PreviewDevice } from "./DevicePreviewToggle";
import {
  buildFreeShippingVariables,
  calculateFreeShippingProgress,
  interpolateFreeShippingText,
} from "../lib/free-shipping";
import {
  getBackgroundImageAttachmentCssValue,
  getBackgroundImagePositionCssValue,
  getBackgroundImageRepeatCssValue,
  getBackgroundImageSizeCssValue,
} from "../utils/campaign-design";
import { buildLowStockMessage } from "../lib/low-stock";
import {
  calculateDeliveryPromise,
  formatDeliveryPromiseMessage,
} from "../lib/delivery-promise";
import {
  calculateTimerState,
  type TimerSettingsInput,
  type TimerState,
  type TimerStorageState,
} from "../lib/timer";

type PreviewPlacement =
  | "TOP_BAR"
  | "BOTTOM_BAR"
  | "PRODUCT_PAGE"
  | "CART_PAGE"
  | "CART_DRAWER"
  | "PRODUCT_BADGE";

type SlotRootProps = {
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
};

type CampaignPreviewProps = {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
  device: PreviewDevice;
  placement: PreviewPlacement;
  // When provided, the preview renders from this saved/edited structural HTML
  // tree (slots hydrated with the live preview pieces) instead of the built-in
  // settings layout. Mirrors the storefront's structure-driven rendering.
  structureTree?: StructureNode | null;
  // The per-campaign CSS (scoped `--cp-*` vars + layout + custom CSS) that goes
  // with structureTree. Applied scoped so the preview matches the storefront.
  structureCss?: string;
  // Custom reusable message snippets the merchant placed in the structure via
  // data-cp-slot="custom-<id>". Filled (and interpolated) into those slots.
  customMessages?: CustomMessage[];
  // When true, each structure node is tagged with `data-cp-node="<path>"` so the
  // visual inspector can resolve hovered/clicked elements back to the AST.
  inspect?: boolean;
};

const placementLabels: Record<PreviewPlacement, string> = {
  TOP_BAR: "Top bar",
  BOTTOM_BAR: "Bottom bar",
  PRODUCT_PAGE: "Product page",
  CART_PAGE: "Cart page",
  CART_DRAWER: "Cart drawer",
  PRODUCT_BADGE: "Badge",
};

const fontFamilies: Record<CampaignDesignValues["fontFamily"], string> = {
  THEME: "inherit",
  SYSTEM:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  SERIF: 'Georgia, "Times New Roman", serif',
  ROUNDED:
    'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif',
  MONO: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  GEOMETRIC:
    'Avenir Next, Avenir, Futura, "Century Gothic", system-ui, sans-serif',
  HUMANIST:
    'Optima, Candara, Calibri, "Segoe UI", Frutiger, system-ui, sans-serif',
  CONDENSED:
    '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif',
  CASUAL: '"Trebuchet MS", Verdana, ui-rounded, system-ui, sans-serif',
};

function usePreviewClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    const timeoutId = window.setTimeout(updateNow, 0);
    const intervalId = window.setInterval(() => {
      updateNow();
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return now;
}

/**
 * Renders a single promo surface (bar/block/badge) with the canonical preview
 * logic and live countdown, without the surrounding storefront chrome. Shared so
 * compact previews (e.g. experiment variant cards) stay identical to the design
 * preview instead of reimplementing the rendering.
 */
export function CampaignPromoSurface({
  viewModel,
  design,
  placement = "TOP_BAR",
  variant = "bar",
  className,
  dataTestId,
  structureTree = null,
  structureCss = "",
}: {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
  placement?: PreviewPlacement;
  variant?: "bar" | "block" | "badge";
  className?: string;
  dataTestId?: string;
  structureTree?: StructureNode | null;
  structureCss?: string;
}) {
  const now = usePreviewClock();
  const evergreenStorage = useMemo(
    () => buildPreviewEvergreenStorage(viewModel.timer),
    [viewModel.timer],
  );
  const timerState =
    viewModel.timer && now
      ? calculateTimerState(
          viewModel.timer,
          now,
          viewModel.timezone,
          evergreenStorage,
        )
      : null;

  return (
    <PromoSurface
      className={className}
      dataTestId={dataTestId}
      design={design}
      now={now}
      placement={placement}
      structureTree={structureTree}
      structureCss={structureCss}
      style={buildPreviewStyle(design)}
      timerState={timerState}
      variant={variant}
      viewModel={viewModel}
    />
  );
}

export function CampaignPreview({
  viewModel,
  design,
  device,
  placement,
  structureTree = null,
  structureCss = "",
  customMessages = [],
  inspect = false,
}: CampaignPreviewProps) {
  const now = usePreviewClock();
  const evergreenStorage = useMemo(
    () => buildPreviewEvergreenStorage(viewModel.timer),
    [viewModel.timer],
  );
  const timerState =
    viewModel.timer && now
      ? calculateTimerState(
          viewModel.timer,
          now,
          viewModel.timezone,
          evergreenStorage,
        )
      : null;
  const previewStyle = buildPreviewStyle(design);
  const viewportStyle = buildPreviewViewportStyle(device);
  const isHiddenOnMobile =
    device === "mobile" && design.mobileEnabled === false;
  const renderPromoSurface = (variant: "bar" | "block" | "badge") => (
    <PromoSurface
      design={design}
      now={now}
      placement={placement}
      structureTree={structureTree}
      structureCss={structureCss}
      customMessages={customMessages}
      inspect={inspect}
      style={previewStyle}
      timerState={timerState}
      variant={variant}
      viewModel={viewModel}
    />
  );

  return (
    <div
      className={`counterpulse-preview-shell counterpulse-preview-shell--${device}`}
      style={viewportStyle}
    >
      <div className="counterpulse-preview-viewport">
        <div className="counterpulse-preview-frame">
          <div className="counterpulse-preview-browser-bar">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <strong>{placementLabels[placement]}</strong>
          </div>
          <div
            className={[
              "counterpulse-preview-storefront",
              `counterpulse-preview-storefront--${placement
                .toLowerCase()
                .replace("_", "-")}`,
            ].join(" ")}
          >
            {isHiddenOnMobile && <MobileDisabledScene />}

            {!isHiddenOnMobile && placement === "TOP_BAR" && (
              <>
                {renderPromoSurface("bar")}
                <ProductPageScene />
              </>
            )}

            {!isHiddenOnMobile && placement === "BOTTOM_BAR" && (
              <>
                <ProductPageScene />
                {renderPromoSurface("bar")}
              </>
            )}

            {!isHiddenOnMobile && placement === "PRODUCT_PAGE" && (
              <ProductPageScene promo={renderPromoSurface("block")} />
            )}

            {!isHiddenOnMobile && placement === "PRODUCT_BADGE" && (
              <ProductPageScene badge={renderPromoSurface("badge")} />
            )}

            {!isHiddenOnMobile && placement === "CART_PAGE" && (
              <CartPageScene promo={renderPromoSurface("block")} />
            )}

            {!isHiddenOnMobile && placement === "CART_DRAWER" && (
              <CartDrawerScene promo={renderPromoSurface("block")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileDisabledScene() {
  return (
    <main className="counterpulse-preview-disabled-scene">
      <div className="counterpulse-preview-disabled-state">
        <strong>Not shown on mobile</strong>
        <span>This campaign still renders for desktop visitors.</span>
      </div>
      <ProductPageScene />
    </main>
  );
}

function buildPreviewViewportStyle(device: PreviewDevice) {
  if (device === "mobile") {
    return {
      "--cp-preview-width": "390px",
      "--cp-preview-height": "760px",
      "--cp-preview-scale": "0.82",
    } as CSSProperties;
  }

  return {
    "--cp-preview-width": "1280px",
    "--cp-preview-height": "800px",
    "--cp-preview-scale": "0.64",
  } as CSSProperties;
}

function ProductPageScene({
  promo,
  badge,
}: {
  promo?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <main className="counterpulse-preview-product-page">
      <section className="counterpulse-preview-product-gallery">
        <div className="counterpulse-preview-product-media">
          {badge}
          <span />
        </div>
        <div className="counterpulse-preview-product-thumbs" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="counterpulse-preview-product-details">
        <span className="counterpulse-preview-product-vendor">
          Qorve Studio
        </span>
        <h2>Essential hoodie</h2>
        <div className="counterpulse-preview-product-rating" aria-hidden="true">
          <span>★★★★★</span>
          <small>128 reviews</small>
        </div>
        <strong>$78.00</strong>

        {promo ? (
          <div className="counterpulse-preview-placement-slot">{promo}</div>
        ) : null}

        <div className="counterpulse-preview-product-options">
          <span>Black</span>
          <span>Stone</span>
          <span>Olive</span>
        </div>
        <div className="counterpulse-preview-purchase-row">
          <span>1</span>
          <button type="button">Add to cart</button>
        </div>
        <div className="counterpulse-preview-product-description">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}

function CartPageScene({ promo }: { promo?: ReactNode }) {
  return (
    <main className="counterpulse-preview-cart-page">
      <header className="counterpulse-preview-cart-header">
        <div>
          <span>Storefront</span>
          <h2>Cart</h2>
        </div>
        <small>2 items</small>
      </header>

      <div className="counterpulse-preview-cart-layout">
        <section className="counterpulse-preview-cart-lines">
          {promo ? (
            <div className="counterpulse-preview-placement-slot">{promo}</div>
          ) : null}
          <CartLine
            meta="Black / Medium"
            name="Essential hoodie"
            price="$78.00"
          />
          <CartLine meta="Matte black" name="Everyday bottle" price="$32.00" />
        </section>

        <aside className="counterpulse-preview-cart-summary">
          <h3>Order summary</h3>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>$110.00</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>Calculated</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>$110.00</dd>
            </div>
          </dl>
          <button type="button">Checkout</button>
        </aside>
      </div>
    </main>
  );
}

function CartDrawerScene({ promo }: { promo?: ReactNode }) {
  return (
    <div className="counterpulse-preview-drawer-scene">
      <div className="counterpulse-preview-drawer-backdrop" aria-hidden="true">
        <ProductPageScene />
      </div>

      <aside className="counterpulse-preview-cart-drawer">
        <header>
          <div>
            <span>Storefront</span>
            <h2>Cart</h2>
          </div>
          <button type="button" aria-label="Close cart preview">
            x
          </button>
        </header>

        {promo ? (
          <div className="counterpulse-preview-placement-slot">{promo}</div>
        ) : null}

        <div className="counterpulse-preview-cart-drawer__lines">
          <CartLine
            compact
            meta="Black / Medium"
            name="Essential hoodie"
            price="$78.00"
          />
          <CartLine
            compact
            meta="Matte black"
            name="Everyday bottle"
            price="$32.00"
          />
        </div>

        <footer>
          <div>
            <span>Subtotal</span>
            <strong>$110.00</strong>
          </div>
          <button type="button">Checkout</button>
        </footer>
      </aside>
    </div>
  );
}

function CartLine({
  name,
  meta,
  price,
  compact = false,
}: {
  name: string;
  meta: string;
  price: string;
  compact?: boolean;
}) {
  return (
    <article
      className={
        compact
          ? "counterpulse-preview-cart-line counterpulse-preview-cart-line--compact"
          : "counterpulse-preview-cart-line"
      }
    >
      <span className="counterpulse-preview-cart-line__media" />
      <div>
        <strong>{name}</strong>
        <span>{meta}</span>
        <small>Qty 1</small>
      </div>
      <b>{price}</b>
    </article>
  );
}

function buildPreviewStyle(design: CampaignDesignValues) {
  return {
    "--cp-surface-bg": getSurfaceBackground(design),
    "--cp-bg": design.backgroundColor,
    "--cp-content-max-width": `${design.contentMaxWidth}px`,
    "--cp-text": design.textColor,
    "--cp-accent": design.accentColor,
    "--cp-button": design.buttonColor,
    "--cp-button-text": design.buttonTextColor,
    "--cp-button-hover": design.buttonHoverColor,
    "--cp-button-text-hover": design.buttonTextHoverColor,
    "--cp-close": design.closeButtonColor,
    "--cp-font-size": `${design.fontSize}px`,
    "--cp-font-family": fontFamilies[design.fontFamily],
    "--cp-radius": `${design.borderRadius}px`,
    "--cp-border-size": `${design.borderSize}px`,
    "--cp-border-color": design.borderColor,
    "--cp-align": getTextAlign(design.alignment),
    "--cp-justify": getJustifyContent(design.alignment),
    "--cp-justify-items": getJustifyItems(design.alignment),
    "--cp-title-size": `${design.titleFontSize}px`,
    "--cp-title-color": design.titleColor,
    "--cp-subheading-size": `${design.subheadingFontSize}px`,
    "--cp-subheading-color": design.subheadingColor,
    // Number/Label size drive all timer sizing (see buildStructureCssVars).
    "--cp-timer-size": `${design.timerNumberFontSize}px`,
    "--cp-timer-color": design.timerColor,
    "--cp-legend-size": `${design.timerLabelFontSize}px`,
    "--cp-legend-color": design.legendColor,
    "--cp-timer-number-size": `${design.timerNumberFontSize}px`,
    "--cp-timer-label-size": `${design.timerLabelFontSize}px`,
    "--cp-timer-gap": `${design.timerGap}px`,
    "--cp-timer-unit-gap": `${design.timerUnitGap}px`,
    "--cp-timer-padding-block": `${design.timerPaddingBlock}px`,
    "--cp-timer-padding-inline": `${design.timerPaddingInline}px`,
    "--cp-timer-surface": design.timerSurfaceColor,
    "--cp-timer-border": design.timerSurfaceBorderColor,
    "--cp-timer-border-size": `${design.timerSurfaceBorderSize}px`,
    "--cp-timer-radius": `${design.timerSurfaceRadius}px`,
    "--cp-padding-block": `${design.paddingBlock}px`,
    "--cp-padding-inline": `${design.paddingInline}px`,
    "--cp-margin-top": `${design.marginTop}px`,
    "--cp-margin-bottom": `${design.marginBottom}px`,
    "--cp-margin-left": `${design.marginLeft}px`,
    "--cp-margin-right": `${design.marginRight}px`,
    "--cp-gap": `${design.contentGap}px`,
    "--cp-sticky-z-index": `${design.positionStickyZIndex}`,
    "--cp-offer-code-text": design.offerCodeTextColor,
    "--cp-offer-code-bg": design.offerCodeBackgroundColor,
    "--cp-offer-code-border": design.offerCodeBorderColor,
    "--cp-offer-code-size": `${design.offerCodeFontSize}px`,
    "--cp-offer-code-radius": `${design.offerCodeBorderRadius}px`,
    "--cp-offer-code-padding-block": `${design.offerCodePaddingBlock}px`,
    "--cp-offer-code-padding-inline": `${design.offerCodePaddingInline}px`,
    "--cp-offer-gap": `${design.offerCodeGap}px`,
    "--cp-offer-copy-bg": design.copyButtonBackgroundColor,
    "--cp-offer-copy-text": design.copyButtonTextColor,
    "--cp-offer-copy-border": design.copyButtonBorderColor,
    "--cp-offer-copy-size": `${design.copyButtonFontSize}px`,
    "--cp-offer-copy-radius": `${design.copyButtonBorderRadius}px`,
    "--cp-offer-apply-bg": design.applyButtonBackgroundColor,
    "--cp-offer-apply-text": design.applyButtonTextColor,
    "--cp-offer-apply-border": design.applyButtonBorderColor,
    "--cp-offer-apply-size": `${design.applyButtonFontSize}px`,
    "--cp-offer-apply-radius": `${design.applyButtonBorderRadius}px`,
    "--cp-badge-bg": design.iconBadgeBackgroundColor,
    "--cp-badge-text": design.iconBadgeTextColor,
    "--cp-badge-size": `${design.iconBadgeFontSize}px`,
    "--cp-badge-radius": `${design.iconBadgeBorderRadius}px`,
    "--cp-split-divider": design.splitDividerEnabled ? "1px" : "0px",
    "--cp-motion-duration": `${design.animationDurationMs}ms`,
    "--cp-tick-duration": `${design.timerTickDurationMs}ms`,
  } as CSSProperties;
}

function getSurfaceBackground(design: CampaignDesignValues) {
  if (design.backgroundType === "IMAGE" && design.backgroundImageUrl) {
    return `linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url("${escapeCssUrl(
      design.backgroundImageUrl,
    )}") ${getBackgroundImagePositionCssValue(
      design.backgroundImagePosition,
    )} / ${getBackgroundImageSizeCssValue(
      design.backgroundImageSize,
    )} ${getBackgroundImageRepeatCssValue(
      design.backgroundImageRepeat,
    )} ${getBackgroundImageAttachmentCssValue(
      design.backgroundImageAttachment,
    )}`;
  }

  if (design.backgroundType === "GRADIENT") {
    return `linear-gradient(${design.gradientAngle}deg, ${design.gradientStartColor}, ${design.gradientEndColor})`;
  }

  return design.backgroundColor;
}

function escapeCssUrl(value: string) {
  return value.replace(/["\\\n\r]/g, "");
}

function getJustifyContent(alignment: CampaignDesignValues["alignment"]) {
  if (alignment === "LEFT") return "flex-start";
  if (alignment === "RIGHT") return "flex-end";
  return "center";
}

function getTextAlign(alignment: CampaignDesignValues["alignment"]) {
  if (alignment === "LEFT") return "left";
  if (alignment === "RIGHT") return "right";
  return "center";
}

function getJustifyItems(alignment: CampaignDesignValues["alignment"]) {
  if (alignment === "LEFT") return "start";
  if (alignment === "RIGHT") return "end";
  return "center";
}

function PromoSurface({
  viewModel,
  design,
  now,
  placement,
  timerState,
  variant,
  style,
  className,
  dataTestId,
  structureTree = null,
  structureCss = "",
  customMessages = [],
  inspect = false,
}: {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
  now: Date | null;
  placement: PreviewPlacement;
  timerState: TimerState | null;
  variant: "bar" | "block" | "badge";
  style: CSSProperties;
  className?: string;
  dataTestId?: string;
  structureTree?: StructureNode | null;
  structureCss?: string;
  customMessages?: CustomMessage[];
  inspect?: boolean;
}) {
  // Unique per-instance scope so merchant custom CSS only styles this surface,
  // mirroring the storefront scoping (data-cp-uid + scoped selectors).
  const scopeId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const freeShippingPreview = buildFreeShippingPreview(viewModel);
  const deliveryPreview = buildDeliveryPreview(viewModel, now);
  const hasBadgeTimer = Boolean(timerState?.isActive || deliveryPreview);

  const lowStockPreview = buildLowStockPreview(viewModel);
  // Dynamic variables work in every field, so interpolate the headline/body/CTA
  // (and badge text) for the preview the same way the storefront surface does.
  const previewNow = now ?? new Date();
  const previewVariables: Record<string, string> = {
    ...buildGlobalDateVariables(previewNow),
    // A representative stock value so {{quantity}} renders in the preview for
    // any field (the storefront uses the real product inventory).
    quantity: "5",
  };
  if (timerState?.isActive) {
    previewVariables.time_left = formatPreviewTimeLeft(timerState.remainingMs);
    Object.assign(
      previewVariables,
      buildCountdownPartVariables(timerState.remainingMs),
    );
  } else if (deliveryPreview) {
    previewVariables.time_left = deliveryPreview.timeRemaining;
  }
  Object.assign(
    previewVariables,
    freeShippingPreview?.variables ?? {},
    lowStockPreview?.variables ?? {},
    deliveryPreview?.variables ?? {},
  );
  const interpolate = (text: string) =>
    interpolatePreviewMessage(text, previewVariables);

  if (variant === "badge") {
    const badgeText = interpolate(
      viewModel.badge?.badgeText || viewModel.badgeText || viewModel.headline,
    );
    return (
      <div
        className={[
          "counterpulse-preview-badge",
          `counterpulse-preview-badge--${(
            viewModel.badge?.badgeShape ?? "PILL"
          ).toLowerCase()}`,
          `counterpulse-preview-badge--${(
            viewModel.badge?.badgePosition ?? "TOP_RIGHT"
          )
            .toLowerCase()
            .replace("_", "-")}`,
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={dataTestId}
        style={style}
      >
        <span>{badgeText}</span>
        {hasBadgeTimer ? (
          <TimerDisplay
            compact
            design={design}
            deliveryTime={deliveryPreview?.timeRemaining}
            timerState={timerState}
          />
        ) : null}
      </div>
    );
  }

  const headlineText = interpolate(
    lowStockPreview ? lowStockPreview.headline : viewModel.headline,
  );
  const bodyText = interpolate(
    deliveryPreview
      ? deliveryPreview.message
      : lowStockPreview
        ? lowStockPreview.detail
        : freeShippingPreview
          ? freeShippingPreview.message
          : timerState?.isExpired && viewModel.expiredText
            ? viewModel.expiredText
            : viewModel.subheadline,
  );
  const hasTimer = Boolean(
    deliveryPreview?.beforeCutoff || timerState?.isActive,
  );
  const isInline = design.layout === "INLINE";
  const hasOffer = isOfferVisible(viewModel, design);
  const hasCta =
    design.showButton &&
    viewModel.cartRescue?.showButton !== false &&
    Boolean(viewModel.ctaText);

  // Structure-driven render: when a saved/edited HTML tree is supplied, render
  // from it (slots hydrated with the live preview pieces) so the preview matches
  // what the storefront will render. Badge keeps the built-in layout.
  if (structureTree) {
    return (
      <StructurePromoSurface
        className={className}
        ctaText={interpolate(viewModel.ctaText)}
        dataTestId={dataTestId}
        deliveryPreview={deliveryPreview}
        design={design}
        freeShippingPreview={freeShippingPreview}
        hasCta={hasCta}
        hasOffer={hasOffer}
        hasTimer={hasTimer}
        headlineHtml={sanitizeBasicHtml(headlineText)}
        bodyHtml={bodyText ? sanitizeBasicHtml(bodyText) : ""}
        customMessagesHtml={Object.fromEntries(
          customMessages.map((message) => [
            message.id,
            sanitizeBasicHtml(interpolate(message.text)),
          ]),
        )}
        messageVariables={previewVariables}
        placement={placement}
        structureCss={structureCss}
        inspect={inspect}
        style={style}
        timerState={timerState}
        tree={structureTree}
        variant={variant}
        viewModel={viewModel}
      />
    );
  }

  return (
    <section
      className={[
        "counterpulse-preview-promo",
        `counterpulse-preview-promo--${variant}`,
        `counterpulse-preview-promo--layout-${design.layout.toLowerCase()}`,
        `counterpulse-preview-promo--placement-${placement
          .toLowerCase()
          .replace("_", "-")}`,
        design.fullWidth ? "counterpulse-preview-promo--full-width" : "",
        variant === "bar" &&
        design.positionMode !== "OVERLAY" &&
        design.positionSticky
          ? "counterpulse-preview-promo--sticky"
          : "",
        `counterpulse-preview-promo--position-${design.positionMode.toLowerCase()}`,
        `counterpulse-preview-promo--enter-${design.entranceAnimation.toLowerCase()}`,
        `counterpulse-preview-promo--exit-${design.exitAnimation.toLowerCase()}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-cp-uid={scopeId}
      data-testid={dataTestId}
      style={style}
    >
      <div className="counterpulse-preview-message">
        <PreviewIcon design={design} />
        <div className="counterpulse-preview-message-copy">
          <strong
            dangerouslySetInnerHTML={{
              __html: sanitizeBasicHtml(headlineText),
            }}
          />
          {isInline && hasTimer ? (
            <TimerDisplay
              compact
              design={design}
              deliveryTime={deliveryPreview?.timeRemaining}
              timerState={timerState}
            />
          ) : null}
          {!isInline && bodyText ? (
            <span
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(bodyText) }}
            />
          ) : null}
        </div>
      </div>

      {!isInline && hasTimer ? (
        <TimerDisplay
          design={design}
          deliveryTime={deliveryPreview?.timeRemaining}
          timerState={timerState}
        />
      ) : null}

      {(hasOffer || hasCta) && (
        <div className="counterpulse-preview-actions">
          <OfferPreview design={design} viewModel={viewModel} />
          {hasCta && (
            <span className="counterpulse-preview-cta">
              {interpolate(viewModel.ctaText)}
            </span>
          )}
        </div>
      )}

      {design.showCloseButton && (
        <span
          className="counterpulse-preview-close"
          aria-hidden="true"
          style={{
            width: `${design.closeButtonSize}px`,
            height: `${design.closeButtonSize}px`,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={design.closeButtonSize}
            height={design.closeButtonSize}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </span>
      )}

      {(() => {
        const pct = resolveProgressPercent(
          design,
          freeShippingPreview,
          timerState,
          viewModel,
        );
        return pct == null ? null : (
          <PreviewProgress
            design={design}
            percentage={pct}
            unlocked={freeShippingPreview?.unlocked}
          />
        );
      })()}

      {design.customCss.trim() ? (
        <style
          dangerouslySetInnerHTML={{
            __html: scopeCustomCss(
              design.customCss.replace(/<\/?\s*style/gi, ""),
              `[data-cp-uid="${scopeId}"]`,
            ),
          }}
        />
      ) : null}
    </section>
  );
}

// Replaces the variant/placement classes on a stored structure root so the same
// saved tree renders correctly for any preview placement/variant. Mirrors
// fixRootClasses() in campaign-surface.js.
function fixStructureRootClasses(
  classValue: string | undefined,
  variant: "bar" | "block",
  placement: PreviewPlacement,
  design: Pick<CampaignDesignValues, "positionMode" | "positionSticky">,
) {
  // Only normalize the auto-generated default surface; render custom HTML as-is.
  if (!(classValue ?? "").includes("counterpulse-preview-promo")) {
    return classValue ?? "";
  }
  const keep = (classValue ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (token) =>
        !/counterpulse-preview-promo--(bar|block|badge)$/.test(token) &&
        !/counterpulse-preview-promo--placement-/.test(token) &&
        token !== "counterpulse-preview-promo--sticky",
    );
  keep.push(`counterpulse-preview-promo--${variant}`);
  keep.push(
    `counterpulse-preview-promo--placement-${placement
      .toLowerCase()
      .replace(/_/g, "-")}`,
  );
  if (
    variant === "bar" &&
    design.positionMode !== "OVERLAY" &&
    design.positionSticky
  ) {
    keep.push("counterpulse-preview-promo--sticky");
  }
  return keep.join(" ");
}

function PreviewCloseButton({
  design,
  className = "",
  style,
  ...rootProps
}: { design: CampaignDesignValues } & SlotRootProps) {
  return (
    <span
      {...rootProps}
      className={["counterpulse-preview-close", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
      style={{
        width: `${design.closeButtonSize}px`,
        height: `${design.closeButtonSize}px`,
        ...(style ?? {}),
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={design.closeButtonSize}
        height={design.closeButtonSize}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      >
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </span>
  );
}

// Resolves the progress percentage for the configured target (mirrors
// progressPercentFor in campaign-surface.js). FREE_SHIPPING uses the cart
// progress; TIMER uses elapsed time (duration for evergreen, start→end for
// fixed). In the preview a sample 60% is shown for a timer target when the total
// span can't be derived, so the styled bar is still visible while editing.
function resolveProgressPercent(
  design: CampaignDesignValues,
  freeShippingPreview: ReturnType<typeof buildFreeShippingPreview>,
  timerState: TimerState | null,
  viewModel: CampaignViewModel,
): number | null {
  if (design.showProgressBar === false) return null;
  if (design.progressTarget === "TIMER") {
    const durationMinutes = viewModel.timer?.durationMinutes;
    const totalMs =
      viewModel.timer?.mode === "EVERGREEN_SESSION" && durationMinutes
        ? durationMinutes * 60000
        : 0;
    if (totalMs > 0 && timerState) {
      const elapsed = totalMs - timerState.remainingMs;
      return Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
    }
    return 60;
  }
  return freeShippingPreview ? freeShippingPreview.percentage : null;
}

function PreviewProgress({
  design,
  percentage,
  unlocked,
  className: incomingClassName = "",
  style: incomingStyle,
  ...rootProps
}: {
  design: CampaignDesignValues;
  percentage: number;
  unlocked?: boolean;
} & SlotRootProps) {
  const pct = Math.round(percentage);
  const style = (design.progressBarStyle || "BAR").toLowerCase();
  const effect = (design.progressEffect || "NONE").toLowerCase();
  const vars = {
    "--cp-progress": `${pct}%`,
    "--cp-progress-track": design.progressTrackColor,
    "--cp-progress-fill": design.progressFillColor,
    "--cp-progress-text": design.progressTextColor,
    "--cp-progress-height": `${design.progressHeight}px`,
    "--cp-progress-radius": `${design.progressRadius}px`,
  } as CSSProperties;
  const className = [
    "counterpulse-preview-progress",
    `counterpulse-preview-progress--${style}`,
    `counterpulse-preview-progress--effect-${effect}`,
    unlocked ? "counterpulse-preview-progress--unlocked" : "",
    incomingClassName,
  ]
    .filter(Boolean)
    .join(" ");

  if (style === "steps") {
    const steps = clampNumber(design.progressSteps, 2, 12, 4);
    const filled = Math.round((pct / 100) * steps);
    return (
      <div
        {...rootProps}
        className={className}
        style={{ ...vars, ...incomingStyle }}
      >
        <span className="counterpulse-preview-progress-steps">
          {Array.from({ length: steps }).map((_, index) => (
            <span key={index} className={index < filled ? "is-filled" : ""} />
          ))}
        </span>
        {design.progressShowLabel && (
          <small className="counterpulse-preview-progress-label">{pct}%</small>
        )}
      </div>
    );
  }

  if (style === "circle") {
    return (
      <div
        {...rootProps}
        className={className}
        style={{ ...vars, ...incomingStyle }}
      >
        <span
          className="counterpulse-preview-progress-circle"
          style={
            { "--cp-progress-deg": `${(pct / 100) * 360}deg` } as CSSProperties
          }
        >
          <span>{design.progressShowLabel ? `${pct}%` : ""}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      {...rootProps}
      className={className}
      style={{ ...vars, ...incomingStyle }}
    >
      <span>
        <span style={{ width: `${pct}%` }} />
      </span>
      {design.progressShowLabel && (
        <small className="counterpulse-preview-progress-label">{pct}%</small>
      )}
    </div>
  );
}

// Renders a campaign from a structural HTML AST, hydrating `data-cp-slot`
// placeholders with the same live preview pieces the legacy layout uses. This is
// the React mirror of buildFromStructure() in campaign-surface.js.
function StructurePromoSurface({
  tree,
  viewModel,
  design,
  style,
  placement,
  variant,
  timerState,
  deliveryPreview,
  freeShippingPreview,
  headlineHtml,
  bodyHtml,
  customMessagesHtml = {},
  messageVariables = {},
  ctaText,
  hasTimer,
  hasOffer,
  hasCta,
  className,
  dataTestId,
  structureCss,
  inspect = false,
}: {
  tree: StructureNode;
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
  style: CSSProperties;
  placement: PreviewPlacement;
  variant: "bar" | "block";
  timerState: TimerState | null;
  deliveryPreview: ReturnType<typeof buildDeliveryPreview>;
  freeShippingPreview: ReturnType<typeof buildFreeShippingPreview>;
  headlineHtml: string;
  bodyHtml: string;
  // Interpolated + sanitized custom-message HTML keyed by message id, filled into
  // data-cp-slot="custom-<id>" slots.
  customMessagesHtml?: Record<string, string>;
  // Dynamic variable values so {{tokens}} in the structure's own text nodes are
  // interpolated (merchants can place variables directly in the custom HTML).
  messageVariables?: Record<string, string>;
  ctaText: string;
  hasTimer: boolean;
  hasOffer: boolean;
  hasCta: boolean;
  className?: string;
  dataTestId?: string;
  structureCss: string;
  inspect?: boolean;
}) {
  // Unique per-instance scope so the campaign CSS (which targets __CP_SCOPE__)
  // only styles this surface — the same scoping the storefront applies.
  const scopeId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const scopedCss = `${STRUCTURE_BASELINE_CSS}\n${structureCss ?? ""}`
    .replace(/__CP_SCOPE__/g, `[data-cp-uid="${scopeId}"]`)
    .replace(/<\/?\s*style/gi, "");
  const renderSlot = (
    node: StructureNode,
    slot: string,
    key: string,
  ): ReactNode => {
    // Author attributes (class/id/style/data-*) on the slot are preserved so
    // merchants can style/position the element. data-cp-* config attrs are read
    // below and not rendered as raw attributes.
    const attrProps = slotAttrProps(node);
    const iconDesign = iconDesignForSlot(node, design);
    const forceCompact = node.attrs?.["data-cp-compact"];
    switch (slot) {
      case "headline":
        return (
          <strong
            key={key}
            {...attrProps}
            dangerouslySetInnerHTML={{ __html: headlineHtml }}
          />
        );
      case "body":
        return bodyHtml ? (
          <span
            key={key}
            {...attrProps}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : null;
      case "cta":
        if (!hasCta) return null;
        return createElement(
          node.tag === "a" ? "a" : node.tag === TEXT_TAG ? "span" : node.tag,
          {
            ...attrProps,
            key,
            className: ["counterpulse-preview-cta", node.attrs?.class]
              .filter(Boolean)
              .join(" "),
          },
          ctaText,
        );
      case "icon":
        return mergeSlotProps(
          <PreviewIcon design={iconDesign} />,
          attrProps,
          key,
        );
      case "timer":
        return hasTimer
          ? mergeSlotProps(
              <TimerDisplay
                compact={forceCompact === "true"}
                design={design}
                deliveryTime={deliveryPreview?.timeRemaining}
                timerState={timerState}
              />,
              attrProps,
              key,
            )
          : null;
      case "timer-inline":
        return hasTimer
          ? mergeSlotProps(
              <TimerDisplay
                compact={forceCompact !== "false"}
                design={design}
                deliveryTime={deliveryPreview?.timeRemaining}
                timerState={timerState}
              />,
              attrProps,
              key,
            )
          : null;
      case "timer-days":
      case "timer-hours":
      case "timer-minutes":
      case "timer-seconds": {
        if (!timerState?.remainingMs) return null;
        const part = TIMER_PART_SLOTS[slot];
        return (
          <span key={key} {...attrProps}>
            {timerPartValue(part, timerState.remainingMs)}
          </span>
        );
      }
      case "offer":
        return hasOffer
          ? mergeSlotProps(
              <OfferPreview design={design} viewModel={viewModel} />,
              attrProps,
              key,
            )
          : null;
      case "close":
        return design.showCloseButton
          ? mergeSlotProps(
              <PreviewCloseButton design={design} />,
              attrProps,
              key,
            )
          : null;
      case "progress": {
        const pct = resolveProgressPercent(
          design,
          freeShippingPreview,
          timerState,
          viewModel,
        );
        return pct == null
          ? null
          : mergeSlotProps(
              <PreviewProgress
                design={design}
                percentage={pct}
                unlocked={freeShippingPreview?.unlocked}
              />,
              attrProps,
              key,
            );
      }
      default: {
        // Custom reusable message: data-cp-slot="custom-<id>".
        const messageId = customMessageIdFromSlot(slot);
        if (messageId && customMessagesHtml[messageId] != null) {
          return (
            <span
              key={key}
              {...attrProps}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{
                __html: customMessagesHtml[messageId],
              }}
            />
          );
        }
        return null;
      }
    }
  };

  const renderNode = (node: StructureNode, key: string): ReactNode => {
    if (node.tag === TEXT_TAG) {
      // Interpolate {{variables}} the merchant typed directly into the custom
      // HTML text so they resolve like message fields do.
      return interpolatePreviewMessage(node.text ?? "", messageVariables);
    }
    const slot = getNodeSlot(node);
    if (slot) {
      const rendered = renderSlot(node, slot, key);
      if (!inspect || rendered == null) return rendered;
      // Wrap replace/fill slot output so the inspector can resolve it back to the
      // AST node. `display: contents` keeps the wrapper out of the layout.
      return createElement(
        "span",
        {
          key,
          "data-cp-node": key,
          style: { display: "contents" } as CSSProperties,
        },
        rendered,
      );
    }
    const children = node.children?.map((child, index) =>
      renderNode(child, `${key}-${index}`),
    );
    return createElement(
      node.tag,
      structureNodeProps(node, key, inspect ? key : undefined),
      children && children.length ? children : undefined,
    );
  };

  const rootClassName = [
    fixStructureRootClasses(tree.attrs?.class, variant, placement, design),
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  // Prefer the campaign's own CSS (vars + layout + custom CSS). Fall back to the
  // merchant custom CSS only when there is no structure CSS.
  const injectedCss =
    scopedCss ||
    (design.customCss.trim()
      ? design.customCss.replace(/<\/?\s*style/gi, "")
      : "");

  const rootProps = structureNodeProps(
    tree,
    "surface",
    inspect ? "" : undefined,
  );
  const surface = createElement(
    tree.tag,
    {
      ...rootProps,
      className: rootClassName,
      // Merge the preview vars with the root node's own inline style so inspector
      // edits on the root container are not overridden by buildPreviewStyle.
      style: { ...style, ...((rootProps.style as CSSProperties) ?? {}) },
      "data-testid": dataTestId,
      suppressHydrationWarning: true,
    },
    (tree.children ?? []).map((child, index) =>
      renderNode(child, String(index)),
    ),
  );

  // Wrap in a scope element that carries the unique id. The campaign CSS targets
  // __CP_SCOPE__ as an ANCESTOR (e.g. `__CP_SCOPE__ .cp-promo {}`), so the id
  // must live on a wrapper, not on the surface root itself. `display: contents`
  // keeps the wrapper invisible to layout.
  return createElement(
    "div",
    {
      "data-cp-uid": scopeId,
      style: { display: "contents" } as CSSProperties,
    },
    [
      surface,
      injectedCss ? (
        <style
          key="structure-css"
          dangerouslySetInnerHTML={{ __html: injectedCss }}
        />
      ) : null,
    ],
  );
}

// HTML attribute names that React needs in a specific (camelCase) form.
const REACT_ATTR_NAMES: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  viewbox: "viewBox",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  preserveaspectratio: "preserveAspectRatio",
};

function parseStyleString(value: string): Record<string, string> {
  return value.split(";").reduce<Record<string, string>>((style, decl) => {
    const idx = decl.indexOf(":");
    if (idx <= 0) return style;
    const prop = decl
      .slice(0, idx)
      .trim()
      .replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
    const propValue = decl.slice(idx + 1).trim();
    if (prop && propValue) style[prop] = propValue;
    return style;
  }, {});
}

// Internal slot markers that must not be rendered as raw HTML attributes.
const SLOT_INTERNAL_ATTRS = new Set([
  "data-cp-slot",
  "data-cp-icon",
  "data-cp-icon-size",
  "data-cp-compact",
]);

// Converts a faithful node's HTML attributes into React props so arbitrary
// merchant HTML (ids, data-*, src, alt, style, ...) renders as written.
function structureNodeProps(
  node: StructureNode,
  key: string | undefined,
  nodePath?: string,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (key !== undefined) props.key = key;
  // Tag the element with its AST path so the visual inspector can resolve it.
  if (nodePath !== undefined) props["data-cp-node"] = nodePath;
  const attrs = node.attrs ?? {};
  for (const name of Object.keys(attrs)) {
    const value = attrs[name];
    if (name === "style") {
      props.style = parseStyleString(value);
      continue;
    }
    props[REACT_ATTR_NAMES[name] ?? name] = value;
  }
  return props;
}

// Author attributes for a slot element: same as structureNodeProps but without
// the internal data-cp-* markers (they configure rendering, not the DOM).
function slotAttrProps(node: StructureNode): Record<string, unknown> {
  const filtered: StructureNode = {
    tag: node.tag,
    attrs: Object.fromEntries(
      Object.entries(node.attrs ?? {}).filter(
        ([name]) => !SLOT_INTERNAL_ATTRS.has(name),
      ),
    ),
  };
  return structureNodeProps(filtered, undefined);
}

function mergeSlotProps(
  element: ReactNode,
  attrProps: Record<string, unknown>,
  key: string,
): ReactNode {
  if (!isValidElement(element)) return element;
  const current = element.props as {
    className?: string;
    style?: CSSProperties;
  };
  const incomingClass = attrProps.className as string | undefined;
  const incomingStyle = attrProps.style as CSSProperties | undefined;
  return cloneElement(element as ReactElement<Record<string, unknown>>, {
    ...attrProps,
    key,
    className: [current.className, incomingClass].filter(Boolean).join(" "),
    style: {
      ...(current.style ?? {}),
      ...(incomingStyle ?? {}),
    },
  });
}

// Per-instance icon override from data-cp-icon / data-cp-icon-size on the slot.
function iconDesignForSlot(
  node: StructureNode,
  design: CampaignDesignValues,
): CampaignDesignValues {
  const icon = node.attrs?.["data-cp-icon"];
  const size = node.attrs?.["data-cp-icon-size"];
  if (!icon && !size) return design;
  return {
    ...design,
    icon: (icon as CampaignDesignValues["icon"]) ?? design.icon,
    iconSize: size ? Number(size) || design.iconSize : design.iconSize,
  };
}

function OfferPreview({
  viewModel,
  design,
  className = "",
  style,
  ...rootProps
}: {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
} & SlotRootProps) {
  const offer = viewModel.offer;

  if (!offer || !isOfferVisible(viewModel, design)) return null;

  const codeNode = design.showDiscountCode ? (
    <span className="counterpulse-preview-code-wrap">
      {design.offerCodeLabel ? (
        <span className="counterpulse-preview-offer-label">
          {design.offerCodeLabel}
        </span>
      ) : null}
      <span className="counterpulse-preview-code">{offer.code}</span>
    </span>
  ) : null;
  const copyNode = design.showCopyCodeButton ? (
    <span className="counterpulse-preview-code-action">
      {design.copyCodeLabel}
    </span>
  ) : null;
  const applyNode =
    design.showApplyDiscountButton && offer.canApply ? (
      <span className="counterpulse-preview-cta counterpulse-preview-cta--offer">
        {design.applyDiscountLabel}
      </span>
    ) : null;
  let content = (
    <>
      {codeNode}
      {copyNode}
      {applyNode}
    </>
  );

  if (design.offerCodeLayout === "STACKED") {
    content = (
      <>
        {codeNode ? (
          <span className="counterpulse-preview-offer-main">{codeNode}</span>
        ) : null}
        {copyNode || applyNode ? (
          <span className="counterpulse-preview-offer-actions">
            {copyNode}
            {applyNode}
          </span>
        ) : null}
      </>
    );
  } else if (design.offerCodeLayout === "COMPACT") {
    content = (
      <>
        {codeNode || copyNode ? (
          <span className="counterpulse-preview-offer-compact-code">
            {codeNode}
            {copyNode}
          </span>
        ) : null}
        {applyNode}
      </>
    );
  }

  return (
    <span
      {...rootProps}
      className={[
        "counterpulse-preview-offer",
        `counterpulse-preview-offer--${design.offerCodeLayout.toLowerCase()}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {content}
    </span>
  );
}

function isOfferVisible(
  viewModel: CampaignViewModel,
  design: CampaignDesignValues,
) {
  const offer = viewModel.offer;

  if (!offer) return false;

  return Boolean(
    design.showDiscountCode ||
    design.showCopyCodeButton ||
    (design.showApplyDiscountButton && offer.canApply),
  );
}

function TimerDisplay({
  design,
  timerState,
  deliveryTime,
  compact = false,
  className = "",
  style,
  ...rootProps
}: {
  design: CampaignDesignValues;
  timerState: TimerState | null;
  deliveryTime?: string;
  compact?: boolean;
} & SlotRootProps) {
  const timerParts = timerState?.isActive
    ? buildTimerParts(timerState.remainingMs, design)
    : buildTimerPartsFromText(deliveryTime);
  const visibleTimerParts = design.timerShowSeconds
    ? timerParts
    : timerParts.filter((part) => part.shortLabel !== "Secs");

  if (!visibleTimerParts.length) return null;

  if (design.timerFormat === "COLON") {
    // Boxes + colon: render one box per number with the ":" separators sitting
    // between the boxes (outside them), instead of a single boxed string.
    if (design.timerStyle === "BOXES") {
      const colonBoxNodes: ReactNode[] = [];

      visibleTimerParts.forEach((part, index) => {
        if (index > 0) {
          colonBoxNodes.push(
            <span
              aria-hidden="true"
              className="counterpulse-preview-timer-sep"
              key={`sep-${index}`}
            >
              :
            </span>,
          );
        }
        colonBoxNodes.push(
          <span className="counterpulse-preview-timer-unit" key={part.label}>
            <strong key={part.value}>{part.value}</strong>
          </span>,
        );
      });

      return (
        <div
          {...rootProps}
          className={[
            "counterpulse-preview-timer",
            "counterpulse-preview-timer--colon",
            "counterpulse-preview-timer--boxes",
            "counterpulse-preview-timer--colon-boxes",
            `counterpulse-preview-timer--tick-${design.timerTickAnimation.toLowerCase()}`,
            compact ? "counterpulse-preview-timer--compact" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          style={style}
          suppressHydrationWarning
        >
          {colonBoxNodes}
        </div>
      );
    }

    const timerText = formatTimerPartsAsColon(visibleTimerParts);

    return (
      <div
        {...rootProps}
        key={timerText}
        className={[
          "counterpulse-preview-timer",
          "counterpulse-preview-timer--colon",
          `counterpulse-preview-timer--${design.timerStyle.toLowerCase()}`,
          `counterpulse-preview-timer--tick-${design.timerTickAnimation.toLowerCase()}`,
          compact ? "counterpulse-preview-timer--compact" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={style}
        suppressHydrationWarning
      >
        {timerText}
      </div>
    );
  }

  if (compact && design.timerStyle === "PLAIN") {
    return (
      <span
        {...rootProps}
        key={visibleTimerParts.map((part) => part.value).join(":")}
        className={[
          "counterpulse-preview-timer",
          "counterpulse-preview-timer--inline-plain",
          `counterpulse-preview-timer--tick-${design.timerTickAnimation.toLowerCase()}`,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={style}
        suppressHydrationWarning
      >
        {visibleTimerParts
          .map((part) =>
            design.timerShowLabels
              ? `${part.value} ${part.shortLabel}`
              : part.value,
          )
          .join(" ")}
      </span>
    );
  }

  return (
    <div
      {...rootProps}
      className={[
        "counterpulse-preview-timer",
        `counterpulse-preview-timer--${design.timerStyle.toLowerCase()}`,
        design.timerNumberLayout === "STACKED"
          ? "counterpulse-preview-timer--stacked"
          : "",
        `counterpulse-preview-timer--tick-${design.timerTickAnimation.toLowerCase()}`,
        compact ? "counterpulse-preview-timer--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      suppressHydrationWarning
    >
      {visibleTimerParts.map((part) => (
        <span className="counterpulse-preview-timer-unit" key={part.label}>
          <strong key={part.value}>{part.value}</strong>
          {design.timerShowLabels ? <small>{part.label}</small> : null}
        </span>
      ))}
    </div>
  );
}

function PreviewIconGlyph({ design }: { design: CampaignDesignValues }) {
  const iconStyle = {
    "--cp-icon-size": `${clampNumber(design.iconSize, 12, 64, 20)}px`,
  } as CSSProperties;

  if (design.icon === "CUSTOM" && design.customIconUrl) {
    return (
      <span
        className="counterpulse-preview-icon"
        style={iconStyle}
        aria-hidden="true"
      >
        <img alt="" src={design.customIconUrl} />
      </span>
    );
  }
  return (
    <span
      className="counterpulse-preview-icon"
      style={iconStyle}
      aria-hidden="true"
    >
      <PreviewIconSvg icon={design.icon} />
    </span>
  );
}

function PreviewIcon({
  design,
  className = "",
  style,
  ...rootProps
}: { design: CampaignDesignValues } & SlotRootProps) {
  // Badge mode: a pill with an optional leading glyph + text label.
  if (design.iconBadgeMode === "BADGE") {
    const text = (design.iconBadgeText ?? "").trim();
    const showGlyph = design.iconBadgeShowGlyph !== false && design.icon !== "NONE";
    if (!text && !showGlyph) return null;
    return (
      <span
        {...rootProps}
        className={["counterpulse-preview-icon-badge", className]
          .filter(Boolean)
          .join(" ")}
        style={style}
      >
        {showGlyph ? <PreviewIconGlyph design={design} /> : null}
        {text ? (
          <span className="counterpulse-preview-icon-badge-text">{text}</span>
        ) : null}
      </span>
    );
  }

  if (design.icon === "NONE") return null;

  return (
    <span
      {...rootProps}
      className={["counterpulse-preview-icon", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--cp-icon-size": `${clampNumber(design.iconSize, 12, 64, 20)}px`,
        ...(style ?? {}),
      } as CSSProperties}
      aria-hidden="true"
    >
      {design.icon === "CUSTOM" && design.customIconUrl ? (
        <img alt="" src={design.customIconUrl} />
      ) : (
        <PreviewIconSvg icon={design.icon} />
      )}
    </span>
  );
}

function PreviewIconSvg({ icon }: { icon: CampaignDesignValues["icon"] }) {
  if (icon === "FIRE") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M12.5 21c-4.1 0-7-2.7-7-6.6 0-2.6 1.4-4.8 3.6-6.9.2 1.7 1 3 2.1 3.8 1.8-2.7 1.4-5.6.3-8.3 4.5 2.2 7 5.9 7 10.5 0 4.4-2.5 7.5-6 7.5Z"
          fill="currentColor"
        />
        <path
          d="M12.2 18.8c-1.7 0-2.9-1.1-2.9-2.7 0-1.2.7-2.2 1.8-3.1.1 1 .6 1.7 1.3 2.1.8-1.1.8-2.4.4-3.6 1.7 1.1 2.7 2.6 2.7 4.3 0 1.8-1.4 3-3.3 3Z"
          fill="rgba(255,255,255,.55)"
        />
      </svg>
    );
  }

  if (icon === "CLOCK") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path
          d="M12 7.5v5l3.4 2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  if (icon === "TRUCK") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M3.5 7h10v8h-10zM13.5 10h3.4l2.6 2.6V15h-6z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="7" cy="17" r="1.8" fill="currentColor" />
        <circle cx="17" cy="17" r="1.8" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "GIFT") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M4.5 10h15v10h-15zM3.5 7h17v3h-17zM12 7v13"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M12 7c-2.4 0-4-1-4-2.4C8 3.7 8.7 3 9.6 3c1.2 0 2 1.4 2.4 4Zm0 0c2.4 0 4-1 4-2.4 0-.9-.7-1.6-1.6-1.6-1.2 0-2 1.4-2.4 4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "TAG") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M4 12.2 12.2 4H20v7.8L11.8 20 4 12.2Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="16.8" cy="7.2" r="1.3" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "STAR") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8L3.5 9.6l5.9-.8L12 3.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "BOLT") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M13 2 4 13.5h6L11 22l9-11.5h-6L13 2Z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "HEART") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M12 20.3 4.7 13c-2-2-2-5.2 0-7.2a4.9 4.9 0 0 1 7 0l.3.3.3-.3a4.9 4.9 0 0 1 7 0c2 2 2 5.2 0 7.2L12 20.3Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "CART") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M3 4h2l2.2 11h9.4l2-7H6.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="9" cy="19" r="1.6" fill="currentColor" />
        <circle cx="17" cy="19" r="1.6" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "PERCENT") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M6 18 18 6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <circle cx="7.5" cy="7.5" r="2.3" fill="currentColor" />
        <circle cx="16.5" cy="16.5" r="2.3" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "BELL") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6l1.5 2h-14l1.5-2Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M10 20a2 2 0 0 0 4 0"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "ROCKET") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M12 3c3.4 1.6 5 4.7 5 8.5L14 15h-4l-3-3.5C7 7.7 8.6 4.6 12 3Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="12" cy="9.5" r="1.6" fill="currentColor" />
        <path
          d="M10 15l-2 4 4-2 4 2-2-4"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "CHECK") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m8.2 12.2 2.6 2.6 5-5.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  return null;
}

function buildTimerParts(remainingMs: number, design: CampaignDesignValues) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const includeDays = !design.timerHideZeroDays || days > 0;
  const hours =
    includeDays || days > 0
      ? Math.floor((totalSeconds % 86400) / 3600)
      : Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    ...(includeDays || days > 0
      ? [
          {
            value: pad(days),
            label: design.timerDaysLabel,
            shortLabel: "Days",
          },
        ]
      : []),
    { value: pad(hours), label: design.timerHoursLabel, shortLabel: "Hrs" },
    {
      value: pad(minutes),
      label: design.timerMinutesLabel,
      shortLabel: "Mins",
    },
    {
      value: pad(seconds),
      label: design.timerSecondsLabel,
      shortLabel: "Secs",
    },
  ];

  return parts;
}

function buildTimerPartsFromText(value: string | undefined) {
  if (!value) return [];

  const segments = value
    .split(":")
    .map((segment) => Number(segment.trim()))
    .filter((segment) => Number.isFinite(segment));

  if (segments.length !== 3) return [];

  return [
    { value: pad(segments[0]), label: "Hrs", shortLabel: "Hrs" },
    { value: pad(segments[1]), label: "Mins", shortLabel: "Mins" },
    { value: pad(segments[2]), label: "Secs", shortLabel: "Secs" },
  ];
}

function formatTimerPartsAsColon(
  timerParts: Array<{ value: string; label: string; shortLabel: string }>,
) {
  return timerParts.map((part) => part.value).join(":");
}

function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number,
) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function pad(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

function buildLowStockPreview(viewModel: CampaignViewModel) {
  if (viewModel.type !== "LOW_STOCK" || !viewModel.lowStock) {
    return null;
  }

  const sampleQuantity = Math.max(1, Math.min(3, viewModel.lowStock.threshold));
  const message = buildLowStockMessage(
    viewModel.lowStock,
    sampleQuantity,
    viewModel.lowStockText,
  );

  if (!message) return null;

  return {
    headline: message,
    detail: "",
    variables: viewModel.lowStock.showExactQuantity
      ? {
          quantity: String(sampleQuantity),
          count: String(sampleQuantity),
        }
      : {},
  };
}

// Current date/time tokens available in every campaign type. Mirrors
// buildGlobalDateVariables in campaign-surface.js.
function buildGlobalDateVariables(now: Date): Record<string, string> {
  return {
    year: String(now.getFullYear()),
    month: now.toLocaleDateString("en-US", { month: "long" }),
    day: String(now.getDate()),
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    date: now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

// Individual countdown components (zero-padded). Mirrors the storefront builder.
function buildCountdownPartVariables(
  remainingMs: number,
): Record<string, string> {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    days_left: String(Math.floor(total / 86400)),
    hours_left: pad(Math.floor((total % 86400) / 3600)),
    minutes_left: pad(Math.floor((total % 3600) / 60)),
    seconds_left: pad(total % 60),
  };
}

function formatPreviewTimeLeft(remainingMs: number) {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const p = (value: number) => String(value).padStart(2, "0");
  if (days > 0) return `${days}d ${p(hours)}h ${p(minutes)}m`;
  if (hours > 0) return `${p(hours)}h ${p(minutes)}m`;
  return `${p(minutes)}m ${p(seconds)}s`;
}

function interpolatePreviewMessage(
  text: string,
  variables: Record<string, string>,
) {
  if (!text || !text.includes("{{")) return text ?? "";

  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match,
  );
}

function buildDeliveryPreview(viewModel: CampaignViewModel, now: Date | null) {
  if (
    !now ||
    viewModel.type !== "DELIVERY_CUTOFF" ||
    !viewModel.deliveryCutoff
  ) {
    return null;
  }

  const promise = calculateDeliveryPromise(
    viewModel.deliveryCutoff,
    now,
    "en-US",
  );

  if (!promise.beforeCutoff && promise.afterCutoffBehavior === "HIDE") {
    return null;
  }

  const template = promise.beforeCutoff
    ? viewModel.deliveryBeforeCutoffText ||
      "Order within {{time_left}} to get it by {{max_delivery_weekday}}"
    : promise.afterCutoffBehavior === "SHOW_AFTER_CUTOFF_MESSAGE"
      ? viewModel.deliveryAfterCutoffText || "Orders placed now ship tomorrow"
      : "Order today and get it between {{delivery_range}}";

  return {
    beforeCutoff: promise.beforeCutoff,
    message: formatDeliveryPromiseMessage(template, promise.messageVariables),
    timeRemaining: promise.messageVariables.time_left,
    variables: promise.messageVariables as Record<string, string>,
  };
}

function buildFreeShippingPreview(viewModel: CampaignViewModel) {
  if (!viewModel.freeShipping || viewModel.type !== "FREE_SHIPPING_GOAL") {
    return null;
  }

  const cartSubtotal = Math.max(
    0,
    viewModel.freeShipping.thresholdAmount * 0.62,
  );
  const progress = calculateFreeShippingProgress(
    viewModel.freeShipping.thresholdAmount,
    cartSubtotal,
  );
  const variables = buildFreeShippingVariables(
    progress,
    viewModel.freeShipping.currencyCode,
    "en-US",
  );
  const amount = variables.remaining_amount;

  if (cartSubtotal <= 0) {
    return {
      message:
        viewModel.freeShippingEmptyText ||
        viewModel.freeShipping.emptyCartMessage ||
        interpolateFreeShippingText(
          viewModel.freeShippingProgressText ||
            "You're {{remaining_amount}} away from free shipping",
          amount,
        ),
      percentage: progress.percentage,
      progressStyle: viewModel.freeShipping.progressStyle,
      unlocked: progress.unlocked,
      variables,
    };
  }

  return {
    message: progress.unlocked
      ? viewModel.freeShippingSuccessText ||
        viewModel.freeShipping.successMessage ||
        "You've unlocked free shipping!"
      : interpolateFreeShippingText(
          viewModel.freeShippingProgressText ||
            "You're {{remaining_amount}} away from free shipping",
          amount,
        ),
    percentage: progress.percentage,
    progressStyle: viewModel.freeShipping.progressStyle,
    unlocked: progress.unlocked,
    variables,
  };
}

function buildPreviewEvergreenStorage(
  timer: TimerSettingsInput | null,
): TimerStorageState | undefined {
  if (timer?.mode !== "EVERGREEN_SESSION" || !timer.durationMinutes) {
    return undefined;
  }

  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + Math.round(timer.durationMinutes) * 60_000,
  );

  return {
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}
