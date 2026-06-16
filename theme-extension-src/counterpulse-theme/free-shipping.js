(function () {
  "use strict";

  var root = document.getElementById("counterpulse-app-embed");
  if (!root) return;

  var config = {
    shop:
      root.dataset.shop ||
      (window.Shopify && window.Shopify.shop) ||
      window.location.hostname,
    path: window.location.pathname,
    locale:
      root.dataset.locale ||
      root.dataset.defaultLocale ||
      document.documentElement.lang ||
      "en",
    country:
      root.dataset.country || (window.Shopify && window.Shopify.country) || "",
    currency:
      root.dataset.cartCurrency || window.CounterPulseCartCurrency || "USD",
    cartSubtotal: readCartSubtotal(root),
    device: window.matchMedia("(max-width: 767px)").matches
      ? "mobile"
      : "desktop",
    debugMode: root.dataset.debug === "true",
  };

  if (!config.shop) return;

  refresh();
  document.addEventListener("cart:updated", refresh);
  document.addEventListener("shopify:section:load", refresh);

  function refresh() {
    readAjaxCartState()
      .then(function (cartState) {
        config.cartSubtotal =
          cartState.subtotal === null
            ? config.cartSubtotal
            : cartState.subtotal;
        config.currency = cartState.currency || config.currency;
        return Promise.all(["TOP_BAR", "BOTTOM_BAR"].map(fetchCampaigns));
      })
      .then(function (responses) {
        responses.flat().forEach(renderCampaign);
      })
      .catch(function (error) {
        debug(error);
      });
  }

  function fetchCampaigns(placement) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: config.path,
      locale: config.locale,
      device: config.device,
      placement: placement,
    });

    if (config.country) params.set("country", config.country);
    if (config.currency) params.set("currency", config.currency);
    if (config.cartSubtotal !== null) {
      params.set("cartSubtotal", String(config.cartSubtotal));
    }

    return window
      .fetch("/apps/counterpulse-campaigns?" + params.toString(), {
        credentials: "omit",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(payload.settings);
        return (
          Array.isArray(payload.campaigns) ? payload.campaigns : []
        ).filter(function (campaign) {
          return campaign.type === "FREE_SHIPPING_GOAL";
        });
      })
      .catch(function (error) {
        debug(placement, error);
        return [];
      });
  }

  function renderCampaign(campaign) {
    var design = campaign.design || {};
    var slotId = "counterpulse-free-shipping-" + campaign.placement;
    var existing = document.getElementById(slotId);
    var container;
    var bar;

    if (design.mobileEnabled === false && config.device === "mobile") return;

    container = getPlacementContainer(campaign.placement);
    bar = buildBar(campaign);
    bar.id = slotId;

    if (existing) {
      existing.replaceWith(bar);
    } else {
      container.appendChild(bar);
    }

    emitImpression(campaign);
  }

  function buildBar(campaign) {
    var design = campaign.design || {};
    var progress = calculateProgress(campaign);
    var bar = document.createElement("section");
    var message = document.createElement("div");
    var headline = document.createElement("strong");
    var detail = document.createElement("span");

    bar.className =
      "pp-bar pp-bar--" +
      campaign.placement.toLowerCase().replace("_", "-") +
      " pp-bar--free-shipping";
    bar.dataset.campaignId = campaign.id;
    bar.setAttribute("role", "region");
    bar.setAttribute(
      "aria-label",
      ((campaign.texts || {}).headline || "Promo Pulse promotion").trim(),
    );
    setDesign(bar, design);

    if (campaign.placement === "TOP_BAR" && design.positionSticky) {
      bar.classList.add("pp-bar--sticky");
    }

    if (design.showIcon !== false && design.icon !== "NONE") {
      bar.appendChild(node("span", "pp-icon", iconLabel(design.icon)));
    }

    message.className = "pp-message";
    headline.textContent = (campaign.texts || {}).headline || "Free shipping";
    detail.textContent = buildMessage(campaign, progress);
    message.appendChild(headline);
    message.appendChild(detail);
    bar.appendChild(message);
    bar.appendChild(renderProgress(progress.percentage, detail.textContent));

    if (campaign.discount && campaign.discount.discountCode) {
      bar.appendChild(
        window.CounterPulseCouponButton(
          campaign.discount.discountCode,
          campaign,
        ),
      );
    }

    if ((campaign.texts || {}).ctaText) {
      bar.appendChild(
        link(
          "pp-cta",
          campaign.texts.ctaText,
          isSafeUrl(campaign.texts.ctaUrl) ? campaign.texts.ctaUrl : "#",
        ),
      );
    }

    if (design.showCloseButton) {
      bar.appendChild(renderCloseButton(bar));
    }

    return bar;
  }

  function buildMessage(campaign, progress) {
    var texts = campaign.texts || {};
    var settings = campaign.freeShipping || {};
    var amount = money(progress.amountRemaining, settings.currencyCode);

    if (progress.cartSubtotal <= 0) {
      return (
        texts.freeShippingEmptyText ||
        settings.emptyCartMessage ||
        interpolate(
          texts.freeShippingProgressText ||
            "You're {{amount}} away from free shipping",
          amount,
        )
      );
    }

    if (progress.unlocked) {
      return (
        texts.freeShippingSuccessText ||
        settings.successMessage ||
        "You've unlocked free shipping!"
      );
    }

    return interpolate(
      texts.freeShippingProgressText ||
        "You're {{amount}} away from free shipping",
      amount,
    );
  }

  function calculateProgress(campaign) {
    var threshold = Number((campaign.freeShipping || {}).thresholdAmount || 0);
    var subtotal = Number(config.cartSubtotal || 0);
    var unlocked = threshold <= 0 || subtotal >= threshold;
    var remaining = unlocked ? 0 : Math.max(0, threshold - subtotal);

    return {
      amountRemaining: Math.round(remaining * 100) / 100,
      cartSubtotal: subtotal,
      percentage:
        threshold <= 0
          ? 100
          : Math.min(100, Math.max(0, (subtotal / threshold) * 100)),
      unlocked: unlocked,
    };
  }

  function renderProgress(percentage, label) {
    var wrapper = document.createElement("div");
    var track = document.createElement("span");
    var fill = document.createElement("span");

    wrapper.className = "pp-progress";
    track.className = "pp-progress__track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", label || "Free shipping progress");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.round(percentage)));
    fill.className = "pp-progress__fill";
    fill.style.width = percentage + "%";
    track.appendChild(fill);
    wrapper.appendChild(track);

    return wrapper;
  }

  function getPlacementContainer(placement) {
    var id = placement === "BOTTOM_BAR" ? "pp-bottom-bars" : "pp-top-bars";
    var existing = document.getElementById(id);
    var container;

    if (existing) return existing;

    container = document.createElement("div");
    container.id = id;
    container.className =
      "pp-container pp-container--" + placement.toLowerCase().replace("_", "-");

    if (placement === "BOTTOM_BAR") {
      document.body.appendChild(container);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }

    return container;
  }

  function readAjaxCartState() {
    return window
      .fetch("/cart.js", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (cart) {
        return {
          subtotal:
            typeof cart.total_price === "number"
              ? cart.total_price / 100
              : null,
          currency: cart.currency || "",
        };
      })
      .catch(function () {
        return { subtotal: null, currency: "" };
      });
  }

  function readCartSubtotal(element) {
    var cents = Number(element.dataset.cartTotalCents);
    if (Number.isFinite(cents)) return cents / 100;
    if (typeof window.CounterPulseCartSubtotal === "number") {
      return window.CounterPulseCartSubtotal;
    }
    return null;
  }

  function setDesign(element, design) {
    element.style.setProperty(
      "--pp-bg",
      color(design.backgroundColor, "#111827"),
    );
    element.style.setProperty("--pp-text", color(design.textColor, "#ffffff"));
    element.style.setProperty(
      "--pp-accent",
      color(design.accentColor, "#22c55e"),
    );
    element.style.setProperty(
      "--pp-button",
      color(design.buttonColor, "#ffffff"),
    );
    element.style.setProperty(
      "--pp-button-text",
      color(design.buttonTextColor, "#111827"),
    );
    element.style.setProperty(
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 14) + "px",
    );
    element.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 24, 0) + "px",
    );
    element.style.setProperty("--pp-justify", justify(design.alignment));
    element.style.setProperty("--pp-align", align(design.alignment));
  }

  function interpolate(template, amount) {
    return template
      .replace(/\{\{\s*amount\s*\}\}/g, amount)
      .replace(/\{\{\s*remaining\s*\}\}/g, amount)
      .replace(/\{\{\s*remaining_amount\s*\}\}/g, amount);
  }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        currency: currency || config.currency || "USD",
        style: "currency",
      }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function link(className, text, href) {
    var anchor = node("a", className, text);
    anchor.href = href;
    anchor.setAttribute("aria-label", text);
    return anchor;
  }

  function renderCloseButton(bar) {
    var button = document.createElement("button");
    button.className = "pp-close";
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.innerHTML = "&times;";
    button.addEventListener("click", function () {
      bar.remove();
    });
    return button;
  }

  function emitImpression(campaign) {
    document.dispatchEvent(
      new CustomEvent("counterpulse:impression", {
        detail: { campaignId: campaign.id, placement: campaign.placement },
      }),
    );
  }

  function iconLabel(icon) {
    return (
      { TRUCK: "Ship", GIFT: "Gift", TAG: "Deal", FIRE: "Sale" }[icon] || "Ship"
    );
  }

  function color(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
  }

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, Math.round(number)))
      : fallback;
  }

  function justify(value) {
    if (value === "LEFT") return "flex-start";
    if (value === "RIGHT") return "flex-end";
    return "center";
  }

  function align(value) {
    if (value === "LEFT") return "left";
    if (value === "RIGHT") return "right";
    return "center";
  }

  function isSafeUrl(url) {
    return url ? url.charAt(0) === "/" || /^https?:\/\//i.test(url) : false;
  }

  function debug() {
    if (config.debugMode && window.console) {
      window.console.log.apply(
        window.console,
        [""].concat([].slice.call(arguments)),
      );
    }
  }

  function applyStorefrontSettings(settings) {
    if (!settings || typeof settings !== "object") return;

    window.CounterPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;
    config.currency = config.currency || settings.defaultCurrency || "";
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
