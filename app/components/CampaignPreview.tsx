import { useEffect, useMemo, useState, type CSSProperties } from "react";

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
  formatTimeRemaining,
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
  PRODUCT_PAGE: "Product page block",
  CART_PAGE: "Cart page block",
  CART_DRAWER: "Cart drawer block",
  PRODUCT_BADGE: "Badge",
};

const iconLabels: Record<CampaignDesignValues["icon"], string> = {
  FIRE: "Fire",
  CLOCK: "Clock",
  TRUCK: "Truck",
  GIFT: "Gift",
  TAG: "Tag",
  NONE: "",
};

export function CampaignPreview({
  viewModel,
  design,
  device,
  placement,
}: CampaignPreviewProps) {
  const [now, setNow] = useState(() => new Date());
  const evergreenStorage = useMemo(
    () => buildPreviewEvergreenStorage(viewModel.timer),
    [viewModel.timer],
  );
  const timerState = viewModel.timer
    ? calculateTimerState(
        viewModel.timer,
        now,
        viewModel.timezone,
        evergreenStorage,
      )
    : null;
  const previewStyle = {
    "--cp-bg": design.backgroundColor,
    "--cp-text": design.textColor,
    "--cp-accent": design.accentColor,
    "--cp-button": design.buttonColor,
    "--cp-button-text": design.buttonTextColor,
    "--cp-font-size": `${design.fontSize}px`,
    "--cp-radius": `${design.borderRadius}px`,
    "--cp-align": design.alignment.toLowerCase(),
    "--cp-justify": getJustifyContent(design.alignment),
  } as CSSProperties;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div
      className={`counterpulse-preview-shell counterpulse-preview-shell--${device}`}
    >
      <div className="counterpulse-preview-frame">
        <div className="counterpulse-preview-storefront">
          {placement === "TOP_BAR" && (
            <PromoSurface
              design={design}
              timerState={timerState}
              viewModel={viewModel}
              variant="bar"
              style={previewStyle}
            />
          )}

          <div className="counterpulse-preview-nav">
            <span>Storefront</span>
            <span>Cart</span>
          </div>

          {placement === "CART_PAGE" ? (
            <div className="counterpulse-preview-cart-page">
              <div className="counterpulse-preview-title">Cart</div>
              <PromoSurface
                design={design}
                timerState={timerState}
                viewModel={viewModel}
                variant="block"
                style={previewStyle}
              />
            </div>
          ) : placement === "PRODUCT_PAGE" || placement === "PRODUCT_BADGE" ? (
            <div className="counterpulse-preview-product">
              <div className="counterpulse-preview-image">
                {placement === "PRODUCT_BADGE" && (
                  <PromoSurface
                    design={design}
                    timerState={timerState}
                    viewModel={viewModel}
                    variant="badge"
                    style={previewStyle}
                  />
                )}
              </div>
              <div className="counterpulse-preview-copy">
                <div className="counterpulse-preview-title">
                  Everyday Hoodie
                </div>
                <div className="counterpulse-preview-price">$78.00</div>
                {placement === "PRODUCT_PAGE" && (
                  <PromoSurface
                    design={design}
                    timerState={timerState}
                    viewModel={viewModel}
                    variant="block"
                    style={previewStyle}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="counterpulse-preview-product counterpulse-preview-product--muted">
              <div className="counterpulse-preview-image" />
              <div className="counterpulse-preview-copy">
                <div className="counterpulse-preview-title">Store preview</div>
                <div className="counterpulse-preview-price">
                  {placementLabels[placement]}
                </div>
              </div>
            </div>
          )}

          {placement === "CART_DRAWER" && (
            <div className="counterpulse-preview-drawer">
              <div className="counterpulse-preview-title">Cart</div>
              <PromoSurface
                design={design}
                timerState={timerState}
                viewModel={viewModel}
                variant="block"
                style={previewStyle}
              />
            </div>
          )}

          {placement === "BOTTOM_BAR" && (
            <PromoSurface
              design={design}
              timerState={timerState}
              viewModel={viewModel}
              variant="bar"
              style={previewStyle}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function getJustifyContent(alignment: CampaignDesignValues["alignment"]) {
  if (alignment === "LEFT") return "flex-start";
  if (alignment === "RIGHT") return "flex-end";
  return "center";
}

function PromoSurface({
  viewModel,
  design,
  timerState,
  variant,
  style,
}: {
  viewModel: CampaignViewModel;
  design: CampaignDesignValues;
  timerState: TimerState | null;
  variant: "bar" | "block" | "badge";
  style: CSSProperties;
}) {
  const freeShippingPreview = buildFreeShippingPreview(viewModel);
  const deliveryPreview = buildDeliveryPreview(viewModel);

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
        {viewModel.badge?.badgeText || viewModel.badgeText}
      </div>
    );
  }

  const lowStockPreview = buildLowStockPreview(viewModel);

  return (
    <div
      className={
        variant === "bar"
          ? "counterpulse-preview-promo counterpulse-preview-promo--bar"
          : "counterpulse-preview-promo"
      }
      style={style}
    >
      {design.showIcon && design.icon !== "NONE" && (
        <span className="counterpulse-preview-icon">
          {iconLabels[design.icon]}
        </span>
      )}
      <div className="counterpulse-preview-message">
        <strong>{viewModel.headline}</strong>
        {deliveryPreview ? (
          <span>{deliveryPreview.message}</span>
        ) : lowStockPreview ? (
          <span>{lowStockPreview.message}</span>
        ) : freeShippingPreview ? (
          <span>{freeShippingPreview.message}</span>
        ) : timerState?.isExpired && viewModel.expiredText ? (
          <span>{viewModel.expiredText}</span>
        ) : (
          viewModel.subheadline && <span>{viewModel.subheadline}</span>
        )}
        {deliveryPreview?.beforeCutoff ? (
          <span className="counterpulse-preview-countdown">
            {deliveryPreview.timeRemaining}
          </span>
        ) : timerState?.isActive ? (
          <span className="counterpulse-preview-countdown">
            {formatTimeRemaining(timerState.remainingMs)}
          </span>
        ) : null}
      </div>
      {viewModel.discountCode && (
        <span className="counterpulse-preview-code">
          {viewModel.discountCode}
        </span>
      )}
      {viewModel.ctaText && (
        <span className="counterpulse-preview-cta">{viewModel.ctaText}</span>
      )}
      {design.showCloseButton && (
        <span className="counterpulse-preview-close" aria-hidden="true">
          x
        </span>
      )}
      {freeShippingPreview && (
        <div className="counterpulse-preview-progress">
          <span>
            <span style={{ width: `${freeShippingPreview.percentage}%` }} />
          </span>
        </div>
      )}
    </div>
  );
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

  return message ? { message } : null;
}

function buildDeliveryPreview(viewModel: CampaignViewModel) {
  if (viewModel.type !== "DELIVERY_CUTOFF" || !viewModel.deliveryCutoff) {
    return null;
  }

  const promise = calculateDeliveryPromise(
    viewModel.deliveryCutoff,
    new Date(),
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
  if (viewModel.type !== "FREE_SHIPPING_GOAL" || !viewModel.freeShipping) {
    return null;
  }

  const cartSubtotal = 0;
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
