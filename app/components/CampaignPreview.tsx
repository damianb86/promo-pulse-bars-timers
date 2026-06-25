import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import type { CampaignViewModel } from "../utils/campaign-view-model";
import type { CampaignDesignValues } from "../types/campaign-design";
import type { PreviewDevice } from "./DevicePreviewToggle";
import {
  calculateFreeShippingProgress,
  formatCurrencyAmount,
  interpolateFreeShippingText,
} from "../lib/free-shipping";
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

type CampaignPreviewProps = {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
  device: PreviewDevice;
  placement: PreviewPlacement;
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

export function CampaignPreview({
  viewModel,
  design,
  device,
  placement,
}: CampaignPreviewProps) {
  const [now, setNow] = useState<Date | null>(null);
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
      style={previewStyle}
      timerState={timerState}
      variant={variant}
      viewModel={viewModel}
    />
  );

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
    "--cp-close": design.closeButtonColor,
    "--cp-font-size": `${design.fontSize}px`,
    "--cp-font-family": fontFamilies[design.fontFamily],
    "--cp-radius": `${design.borderRadius}px`,
    "--cp-border-size": `${design.borderSize}px`,
    "--cp-border-color": design.borderColor,
    "--cp-align": getTextAlign(design.alignment),
    "--cp-justify": getJustifyContent(design.alignment),
    "--cp-title-size": `${design.titleFontSize}px`,
    "--cp-title-color": design.titleColor,
    "--cp-subheading-size": `${design.subheadingFontSize}px`,
    "--cp-subheading-color": design.subheadingColor,
    "--cp-timer-size": `${design.timerFontSize}px`,
    "--cp-timer-color": design.timerColor,
    "--cp-legend-size": `${design.legendFontSize}px`,
    "--cp-legend-color": design.legendColor,
    "--cp-timer-surface": design.timerSurfaceColor,
    "--cp-timer-border": design.timerSurfaceBorderColor,
    "--cp-timer-border-size": `${design.timerSurfaceBorderSize}px`,
    "--cp-timer-radius": `${design.timerSurfaceRadius}px`,
    "--cp-padding-block": `${design.paddingBlock}px`,
    "--cp-padding-inline": `${design.paddingInline}px`,
    "--cp-gap": `${design.contentGap}px`,
    "--cp-offer-code-text": design.offerCodeTextColor,
    "--cp-offer-code-bg": design.offerCodeBackgroundColor,
    "--cp-offer-code-border": design.offerCodeBorderColor,
    "--cp-offer-code-size": `${design.offerCodeFontSize}px`,
    "--cp-offer-code-radius": `${design.offerCodeBorderRadius}px`,
    "--cp-offer-code-padding-block": `${design.offerCodePaddingBlock}px`,
    "--cp-offer-code-padding-inline": `${design.offerCodePaddingInline}px`,
    "--cp-offer-gap": `${design.offerCodeGap}px`,
    "--cp-motion-duration": `${design.animationDurationMs}ms`,
  } as CSSProperties;
}

function getSurfaceBackground(design: CampaignDesignValues) {
  if (design.backgroundType === "IMAGE" && design.backgroundImageUrl) {
    return `linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url("${escapeCssUrl(
      design.backgroundImageUrl,
    )}") center / cover no-repeat`;
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

function PromoSurface({
  viewModel,
  design,
  now,
  placement,
  timerState,
  variant,
  style,
}: {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
  now: Date | null;
  placement: PreviewPlacement;
  timerState: TimerState | null;
  variant: "bar" | "block" | "badge";
  style: CSSProperties;
}) {
  const freeShippingPreview = buildFreeShippingPreview(viewModel);
  const deliveryPreview = buildDeliveryPreview(viewModel, now);
  const hasBadgeTimer = Boolean(timerState?.isActive || deliveryPreview);

  if (variant === "badge") {
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
        ].join(" ")}
        style={style}
      >
        <span>
          {viewModel.badge?.badgeText ||
            viewModel.badgeText ||
            viewModel.headline}
        </span>
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

  const lowStockPreview = buildLowStockPreview(viewModel);
  const headlineText = lowStockPreview
    ? lowStockPreview.headline
    : viewModel.headline;
  const bodyText = deliveryPreview
    ? deliveryPreview.message
    : lowStockPreview
      ? lowStockPreview.detail
      : freeShippingPreview
        ? freeShippingPreview.message
        : timerState?.isExpired && viewModel.expiredText
          ? viewModel.expiredText
          : viewModel.subheadline;
  const hasTimer = Boolean(
    deliveryPreview?.beforeCutoff || timerState?.isActive,
  );
  const isInline = design.layout === "INLINE";
  const hasOffer = isOfferVisible(viewModel, design);
  const hasCta =
    design.showButton &&
    viewModel.cartRescue?.showButton !== false &&
    Boolean(viewModel.ctaText);

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
        `counterpulse-preview-promo--position-${design.positionMode.toLowerCase()}`,
        `counterpulse-preview-promo--enter-${design.entranceAnimation.toLowerCase()}`,
        `counterpulse-preview-promo--exit-${design.exitAnimation.toLowerCase()}`,
      ].join(" ")}
      style={style}
    >
      <div className="counterpulse-preview-message">
        <PreviewIcon design={design} />
        <div className="counterpulse-preview-message-copy">
          <strong>{headlineText}</strong>
          {isInline && hasTimer ? (
            <TimerDisplay
              compact
              design={design}
              deliveryTime={deliveryPreview?.timeRemaining}
              timerState={timerState}
            />
          ) : null}
          {!isInline && bodyText ? (
            <span suppressHydrationWarning>{bodyText}</span>
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
              {viewModel.ctaText}
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

      {freeShippingPreview && design.showProgressBar !== false && (
        <div
          className={[
            "counterpulse-preview-progress",
            `counterpulse-preview-progress--${freeShippingPreview.progressStyle.toLowerCase()}`,
            freeShippingPreview.unlocked
              ? "counterpulse-preview-progress--unlocked"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            {
              "--cp-progress": `${freeShippingPreview.percentage}%`,
            } as CSSProperties
          }
        >
          <span>
            <span style={{ width: `${freeShippingPreview.percentage}%` }} />
          </span>
        </div>
      )}
    </section>
  );
}

function OfferPreview({
  viewModel,
  design,
}: {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
}) {
  const offer = viewModel.offer;

  if (!offer || !isOfferVisible(viewModel, design)) return null;

  return (
    <span
      className={[
        "counterpulse-preview-offer",
        `counterpulse-preview-offer--${design.offerCodeLayout.toLowerCase()}`,
      ].join(" ")}
    >
      {design.showDiscountCode ? (
        <span className="counterpulse-preview-code-wrap">
          {design.offerCodeLabel ? (
            <span className="counterpulse-preview-offer-label">
              {design.offerCodeLabel}
            </span>
          ) : null}
          <span className="counterpulse-preview-code">{offer.code}</span>
        </span>
      ) : null}
      {design.showCopyCodeButton ? (
        <span className="counterpulse-preview-code-action">
          {design.copyCodeLabel}
        </span>
      ) : null}
      {design.showApplyDiscountButton && offer.canApply ? (
        <span className="counterpulse-preview-cta counterpulse-preview-cta--offer">
          {design.applyDiscountLabel}
        </span>
      ) : null}
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
}: {
  design: CampaignDesignValues;
  timerState: TimerState | null;
  deliveryTime?: string;
  compact?: boolean;
}) {
  const timerParts = timerState?.isActive
    ? buildTimerParts(timerState.remainingMs, design)
    : buildTimerPartsFromText(deliveryTime);
  const visibleTimerParts = design.timerShowSeconds
    ? timerParts
    : timerParts.filter((part) => part.shortLabel !== "Secs");

  if (!visibleTimerParts.length) return null;

  if (design.timerFormat === "COLON") {
    const timerText = formatTimerPartsAsColon(visibleTimerParts);

    return (
      <div
        key={timerText}
        className={[
          "counterpulse-preview-timer",
          "counterpulse-preview-timer--colon",
          `counterpulse-preview-timer--${design.timerStyle.toLowerCase()}`,
          `counterpulse-preview-timer--tick-${design.timerTickAnimation.toLowerCase()}`,
          compact ? "counterpulse-preview-timer--compact" : "",
        ].join(" ")}
        suppressHydrationWarning
      >
        {timerText}
      </div>
    );
  }

  if (compact && design.timerStyle === "PLAIN") {
    return (
      <span
        key={visibleTimerParts.map((part) => part.value).join(":")}
        className={[
          "counterpulse-preview-timer",
          "counterpulse-preview-timer--inline-plain",
          `counterpulse-preview-timer--tick-${design.timerTickAnimation.toLowerCase()}`,
        ].join(" ")}
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
      className={[
        "counterpulse-preview-timer",
        `counterpulse-preview-timer--${design.timerStyle.toLowerCase()}`,
        design.timerNumberLayout === "STACKED"
          ? "counterpulse-preview-timer--stacked"
          : "",
        `counterpulse-preview-timer--tick-${design.timerTickAnimation.toLowerCase()}`,
        compact ? "counterpulse-preview-timer--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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

function PreviewIcon({ design }: { design: CampaignDesignValues }) {
  if (design.icon === "NONE") return null;

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
  };
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
      "Order within {{time_remaining}} to get it by {{max_delivery_weekday}}"
    : promise.afterCutoffBehavior === "SHOW_AFTER_CUTOFF_MESSAGE"
      ? viewModel.deliveryAfterCutoffText || "Orders placed now ship tomorrow"
      : "Order today and get it between {{delivery_range}}";

  return {
    beforeCutoff: promise.beforeCutoff,
    message: formatDeliveryPromiseMessage(template, promise.messageVariables),
    timeRemaining: promise.messageVariables.time_remaining,
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
  const amount = formatCurrencyAmount(
    progress.amountRemaining,
    viewModel.freeShipping.currencyCode,
    "en-US",
  );

  if (cartSubtotal <= 0) {
    return {
      message:
        viewModel.freeShippingEmptyText ||
        viewModel.freeShipping.emptyCartMessage ||
        interpolateFreeShippingText(
          viewModel.freeShippingProgressText ||
            "You're {{amount}} away from free shipping",
          amount,
        ),
      percentage: progress.percentage,
      progressStyle: viewModel.freeShipping.progressStyle,
      unlocked: progress.unlocked,
    };
  }

  return {
    message: progress.unlocked
      ? viewModel.freeShippingSuccessText ||
        viewModel.freeShipping.successMessage ||
        "You've unlocked free shipping!"
      : interpolateFreeShippingText(
          viewModel.freeShippingProgressText ||
            "You're {{amount}} away from free shipping",
          amount,
        ),
    percentage: progress.percentage,
    progressStyle: viewModel.freeShipping.progressStyle,
    unlocked: progress.unlocked,
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
