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
    market: detectMarket(root),
    currency: detectCurrency(root) || "USD",
    cartSubtotal: readCartSubtotal(root),
    device: window.matchMedia("(max-width: 767px)").matches
      ? "mobile"
      : "desktop",
    debugMode: root.dataset.debug === "true",
    apiBaseUrl: root.dataset.apiBaseUrl || window.CounterPulseApiBaseUrl || "",
  };
  var refreshTimer = 0;
  var refreshInFlight = false;
  var lastRefreshAt = 0;
  var minimumRefreshGapMs = 2000;
  var proxyPauseMs = 60000;
  var cartPauseMs = 30000;

  if (!config.shop) {
    updateDebug(root, "Free shipping detenido: falta el shop domain.");
    return;
  }

  scheduleRefresh(true);
  document.addEventListener("cart:updated", function () {
    scheduleRefresh(true);
  });
  document.addEventListener("shopify:section:load", function () {
    scheduleRefresh(false);
  });

  function scheduleRefresh(force) {
    if (refreshInFlight) return;

    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(
      function () {
        refresh(!!force);
      },
      force ? 80 : 300,
    );
  }

  function refresh(force) {
    var now = Date.now();

    if (refreshInFlight) return;
    if (!force && now - lastRefreshAt < minimumRefreshGapMs) return;
    if (force && now - lastRefreshAt < 500) return;
    if (isPaused("CounterPulseProxyPausedUntil")) {
      updateDebug(
        root,
        "Free shipping pausado temporalmente porque Shopify devolvio password/HTML en una llamada anterior.",
      );
      return;
    }

    refreshInFlight = true;
    lastRefreshAt = now;

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
        updateDebug(
          root,
          "Free shipping API OK: " +
            responses.flat().length +
            " campana(s) globales recibidas.",
        );
        responses.flat().forEach(renderCampaign);
      })
      .catch(function (error) {
        updateDebug(root, "Error global FREE_SHIPPING_GOAL: " + error.message);
        debug(error);
      })
      .finally(function () {
        refreshInFlight = false;
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
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.cartSubtotal !== null) {
      params.set("cartSubtotal", String(config.cartSubtotal));
    }
    appendBehaviorTargetingParams(params);
    var url = getCampaignsEndpoint(config.apiBaseUrl) + "?" + params.toString();

    if (isPaused("CounterPulseProxyPausedUntil")) {
      updateDebug(
        root,
        "App Proxy pausado temporalmente porque Shopify devolvio password/HTML en una llamada anterior.",
        url,
      );
      return Promise.resolve([]);
    }

    updateDebug(root, "Consultando FREE_SHIPPING_GOAL " + placement + ".", url);

    return window
      .fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        assertJsonResponse(response, url);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(payload.settings);
        return (Array.isArray(payload.campaigns) ? payload.campaigns : [])
          .map(applyExperiment)
          .filter(function (campaign) {
            return campaign.type === "FREE_SHIPPING_GOAL";
          });
      })
      .then(function (campaigns) {
        updateDebug(
          root,
          "API OK: " +
            campaigns.length +
            " FREE_SHIPPING_GOAL para " +
            placement +
            ".",
          url,
        );
        return campaigns;
      })
      .catch(function (error) {
        updateDebug(
          root,
          "Error FREE_SHIPPING_GOAL " + placement + ": " + error.message,
          url,
        );
        debug(placement, error);
        return [];
      });
  }

  function applyExperiment(campaign) {
    if (window.CounterPulseApplyExperiment) {
      return window.CounterPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  function assertJsonResponse(response, url) {
    var contentType = response.headers.get("content-type") || "";
    var redirectedTo = response.redirected
      ? " Redirected to " + response.url
      : "";

    if (
      response.redirected ||
      response.url.indexOf("/password") !== -1 ||
      contentType.indexOf("application/json") === -1
    ) {
      pauseRequests("CounterPulseProxyPausedUntil", proxyPauseMs);
      throw new Error(
        "Expected JSON from app proxy but received " +
          (contentType || "unknown content-type") +
          "." +
          redirectedTo +
          " Check Shopify app_proxy config for " +
          url +
          ".",
      );
    }
  }

  function appendBehaviorTargetingParams(params) {
    var tracking =
      typeof window.CounterPulseGetVisitorSessionTracking === "function"
        ? window.CounterPulseGetVisitorSessionTracking()
        : null;

    if (!tracking) return;
    if (tracking.visitorId) params.set("visitorId", tracking.visitorId);
    if (tracking.sessionId) params.set("sessionId", tracking.sessionId);
    params.set("doNotTrack", tracking.doNotTrack ? "true" : "false");
    if (
      tracking.consentGranted !== null &&
      tracking.consentGranted !== undefined
    ) {
      params.set("consentGranted", tracking.consentGranted ? "true" : "false");
    }
  }

  function getCampaignsEndpoint(apiBaseUrl) {
    var value = String(apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/counterpulse-campaigns";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function renderCampaign(campaign) {
    var design = campaign.design || {};
    var slotId = "counterpulse-free-shipping-" + campaign.placement;
    var existing = document.getElementById(slotId);
    var container;
    var bar;

    if (design.mobileEnabled === false && config.device === "mobile") {
      updateDebug(
        root,
        "FREE_SHIPPING_GOAL recibido, pero mobileEnabled=false y el dispositivo detectado es mobile.",
      );
      return;
    }

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
  function updateDebug(element, message, url) {
    var status;
    var endpoint;

    if (!element || element.dataset.debug !== "true") return;

    status = element.querySelector("[data-pp-debug-status]");
    endpoint = element.querySelector("[data-pp-debug-url]");

    if (status) status.textContent = message;
    if (endpoint && url) endpoint.textContent = url;
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
    if (design.fullWidth) bar.classList.add("pp-bar--full-width");
    if (design.positionMode === "OVERLAY") bar.classList.add("pp-bar--overlay");
    bar.dataset.campaignId = campaign.id;
    bar.dataset.testid = "promo-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute(
      "aria-label",
      ((campaign.texts || {}).headline || "Promo Pulse promotion").trim(),
    );
    setDesign(bar, design);

    if (
      campaign.placement === "TOP_BAR" &&
      design.positionMode !== "OVERLAY" &&
      design.positionSticky
    ) {
      bar.classList.add("pp-bar--sticky");
    }

    var icon = renderDesignIcon(design);
    if (icon) bar.appendChild(icon);

    message.className = "pp-message";
    headline.textContent = (campaign.texts || {}).headline || "Free shipping";
    detail.textContent = buildMessage(campaign, progress);
    message.appendChild(headline);
    message.appendChild(detail);
    bar.appendChild(message);
    bar.appendChild(renderProgress(progress.percentage, detail.textContent));

    if (
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.CounterPulseCouponButton === "function"
    ) {
      bar.appendChild(
        window.CounterPulseCouponButton(
          campaign.discount.discountCode,
          campaign,
        ),
      );
    }

    if (design.showButton !== false && (campaign.texts || {}).ctaText) {
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
    wrapper.dataset.testid = "free-shipping-progress";
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
    if (isPaused("CounterPulseCartPausedUntil")) {
      return Promise.resolve({ subtotal: null, currency: "" });
    }

    return window
      .fetch("/cart.js", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        assertCartJsonResponse(response);
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

  function assertCartJsonResponse(response) {
    var contentType = response.headers.get("content-type") || "";

    if (
      response.redirected ||
      response.url.indexOf("/password") !== -1 ||
      contentType.indexOf("application/json") === -1
    ) {
      pauseRequests("CounterPulseCartPausedUntil", cartPauseMs);
      throw new Error(
        "Expected JSON from /cart.js but received storefront HTML.",
      );
    }
  }

  function readCartSubtotal(element) {
    var cents = Number(element.dataset.cartTotalCents);
    if (Number.isFinite(cents)) return cents / 100;
    if (typeof window.CounterPulseCartSubtotal === "number") {
      return window.CounterPulseCartSubtotal;
    }
    return null;
  }

  function detectMarket(element) {
    var shopifyMarket = window.Shopify && window.Shopify.market;

    return (
      element.dataset.market ||
      (shopifyMarket &&
        (shopifyMarket.handle || shopifyMarket.id || shopifyMarket)) ||
      ""
    );
  }

  function detectCurrency(element) {
    return (
      element.dataset.cartCurrency ||
      window.CounterPulseCartCurrency ||
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
      ""
    );
  }

  function setDesign(element, design) {
    element.style.setProperty("--pp-bg", getBackground(design));
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
      "--pp-close",
      color(design.closeButtonColor, color(design.textColor, "#ffffff")),
    );
    element.style.setProperty(
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 14) + "px",
    );
    element.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 24, 0) + "px",
    );
    element.style.setProperty(
      "--pp-content-max-width",
      clamp(design.contentMaxWidth, 280, 1440, 960) + "px",
    );
    element.style.setProperty(
      "--pp-padding-block",
      clamp(design.paddingBlock, 4, 48, 11) + "px",
    );
    element.style.setProperty(
      "--pp-padding-inline",
      clamp(design.paddingInline, 8, 64, 16) + "px",
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
        detail: {
          campaignId: campaign.id,
          experimentId:
            campaign.experimentId ||
            (campaign.experiment && campaign.experiment.id) ||
            null,
          variantId:
            campaign.variantId ||
            (campaign.variant && campaign.variant.id) ||
            null,
          placement: campaign.placement,
        },
      }),
    );
  }

  function renderDesignIcon(design) {
    var icon = document.createElement("span");
    var image;
    var svg;

    if (!design || design.showIcon === false) return null;

    icon.className = "pp-icon";

    if (design.icon === "CUSTOM" && isSafeIconUrl(design.customIconUrl)) {
      image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = design.customIconUrl;
      icon.appendChild(image);
      return icon;
    }

    svg = getIconSvg(design.icon || "TRUCK");
    if (!svg) return null;

    icon.innerHTML = svg;
    return icon;
  }

  function isSafeIconUrl(value) {
    return (
      typeof value === "string" &&
      (value.charAt(0) === "/" ||
        /^https?:\/\//i.test(value) ||
        /^data:image\/(?:svg\+xml|png|jpe?g);base64,/i.test(value))
    );
  }

  function getIconSvg(icon) {
    return (
      {
        FIRE: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12.5 21c-4.1 0-7-2.7-7-6.6 0-2.6 1.4-4.8 3.6-6.9.2 1.7 1 3 2.1 3.8 1.8-2.7 1.4-5.6.3-8.3 4.5 2.2 7 5.9 7 10.5 0 4.4-2.5 7.5-6 7.5Z" fill="currentColor"/></svg>',
        CLOCK:
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7.5v5l3.4 2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.2"/></svg>',
        TRUCK:
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 7h10v8h-10zM13.5 10h3.4l2.6 2.6V15h-6z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"/><circle cx="7" cy="17" r="1.8" fill="currentColor"/><circle cx="17" cy="17" r="1.8" fill="currentColor"/></svg>',
        GIFT: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 10h15v10h-15zM3.5 7h17v3h-17zM12 7v13" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"/><path d="M12 7c-2.4 0-4-1-4-2.4C8 3.7 8.7 3 9.6 3c1.2 0 2 1.4 2.4 4Zm0 0c2.4 0 4-1 4-2.4 0-.9-.7-1.6-1.6-1.6-1.2 0-2 1.4-2.4 4Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
        TAG: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12.2 12.2 4H20v7.8L11.8 20 4 12.2Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"/><circle cx="16.8" cy="7.2" r="1.3" fill="currentColor"/></svg>',
      }[icon] || ""
    );
  }

  function color(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
  }

  function getBackground(design) {
    if (
      design &&
      design.backgroundType === "IMAGE" &&
      isSafeImageUrl(design.backgroundImageUrl)
    ) {
      return (
        'linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url("' +
        escapeCssUrl(design.backgroundImageUrl) +
        '") center / cover no-repeat'
      );
    }

    if (design && design.backgroundType === "GRADIENT") {
      return (
        "linear-gradient(" +
        clamp(design.gradientAngle, 0, 360, 90) +
        "deg, " +
        color(design.gradientStartColor, "#252237") +
        ", " +
        color(design.gradientEndColor, "#4c4861") +
        ")"
      );
    }

    return color(design.backgroundColor, "#111827");
  }

  function isSafeImageUrl(value) {
    return (
      typeof value === "string" &&
      (value.charAt(0) === "/" || /^https?:\/\//i.test(value))
    );
  }

  function escapeCssUrl(value) {
    return String(value || "").replace(/["\\\n\r]/g, "");
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

  function isPaused(key) {
    return Number(window[key] || 0) > Date.now();
  }

  function pauseRequests(key, ms) {
    window[key] = Math.max(Number(window[key] || 0), Date.now() + ms);
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
