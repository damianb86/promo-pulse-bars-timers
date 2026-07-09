(function () {
  "use strict";

  var root = document.getElementById("promo-pulse-app-embed");
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
    productId: root.dataset.productId || "",
    productTags: splitList(root.dataset.productTags),
    collectionIds: splitList(root.dataset.collectionIds),
    device: detectDevice(),
    debugMode: root.dataset.debug === "true",
    apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
  };
  var refreshTimer = 0;
  var refreshInFlight = false;
  var refreshQueued = false;
  var lastRefreshAt = 0;
  var minimumRefreshGapMs = 2000;
  var freeShippingCampaigns = [];
  var campaignsLoaded = false;
  var trackedImpressions = {};
  var proxyPauseMs = 60000;
  var cartPauseMs = 30000;

  if (!config.shop) {
    updateDebug(root, "Free shipping detenido: falta el shop domain.");
    return;
  }

  installCartChangeWatcher();
  scheduleRefresh(true, true);
  [
    "promo-pulse:cart-changed",
    "cart:updated",
    "cart:change",
    "cart:refresh",
    "ajaxCart:updated",
    "theme:cart:change",
  ].forEach(function (eventName) {
    document.addEventListener(eventName, function () {
      scheduleRefresh(true, false);
    });
  });
  document.addEventListener("shopify:section:load", function () {
    scheduleRefresh(false, !campaignsLoaded);
  });

  function scheduleRefresh(force, shouldFetchCampaigns) {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(
      function () {
        refresh(!!force, shouldFetchCampaigns !== false);
      },
      force ? 80 : 300,
    );
  }

  function refresh(force, shouldFetchCampaigns) {
    var now = Date.now();

    if (refreshInFlight) return;
    if (!force && now - lastRefreshAt < minimumRefreshGapMs) return;
    if (isPaused("PromoPulseProxyPausedUntil")) {
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
        if (!shouldFetchCampaigns && campaignsLoaded) {
          return freeShippingCampaigns;
        }

        return fetchCampaigns().then(function (campaigns) {
          freeShippingCampaigns = campaigns;
          campaignsLoaded = true;
          return campaigns;
        });
      })
      .then(function (campaigns) {
        updateDebug(
          root,
          "Free shipping API OK: " +
            campaigns.length +
            " campana(s) globales disponibles.",
        );
        campaigns.forEach(renderCampaign);
      })
      .catch(function (error) {
        updateDebug(root, "Error global FREE_SHIPPING_GOAL: " + error.message);
        debug(error);
      })
      .finally(function () {
        refreshInFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          scheduleRefresh(true, false);
        }
      });
  }

  function fetchCampaigns() {
    var params = new URLSearchParams({
      shop: config.shop,
      path: config.path,
      locale: config.locale,
      device: config.device,
      placement: "TOP_BAR,BOTTOM_BAR",
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.productId) params.set("productId", config.productId);
    if (config.productTags.length) {
      params.set("productTags", config.productTags.join(","));
    }
    if (config.collectionIds.length) {
      params.set("collectionIds", config.collectionIds.join(","));
    }
    appendBehaviorTargetingParams(params);
    var url = getCampaignsEndpoint(config.apiBaseUrl) + "?" + params.toString();

    if (isPaused("PromoPulseProxyPausedUntil")) {
      updateDebug(
        root,
        "App Proxy pausado temporalmente porque Shopify devolvio password/HTML en una llamada anterior.",
        url,
      );
      return Promise.resolve([]);
    }

    updateDebug(root, "Consultando FREE_SHIPPING_GOAL global.", url);

    if (window.PromoPulseFetchCampaigns) {
      return window
        .PromoPulseFetchCampaigns(config, "TOP_BAR,BOTTOM_BAR")
        .then(function (payload) {
          applyStorefrontSettings(config, payload.settings);
          return (Array.isArray(payload.campaigns) ? payload.campaigns : [])
            .map(applyExperiment)
            .filter(function (campaign) {
              return campaign.type === "FREE_SHIPPING_GOAL";
            });
        })
        .then(function (campaigns) {
          updateDebug(
            root,
            "API OK: " + campaigns.length + " FREE_SHIPPING_GOAL globales.",
            url,
          );
          return campaigns;
        })
        .catch(function (error) {
          updateDebug(
            root,
            "Error FREE_SHIPPING_GOAL global: " + error.message,
            url,
          );
          debug(error);
          return [];
        });
    }

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
          "API OK: " + campaigns.length + " FREE_SHIPPING_GOAL globales.",
          url,
        );
        return campaigns;
      })
      .catch(function (error) {
        updateDebug(
          root,
          "Error FREE_SHIPPING_GOAL global: " + error.message,
          url,
        );
        debug(error);
        return [];
      });
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
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
      pauseRequests("PromoPulseProxyPausedUntil", proxyPauseMs);
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
      typeof window.PromoPulseGetVisitorSessionTracking === "function"
        ? window.PromoPulseGetVisitorSessionTracking()
        : null;

    if (!tracking) return;
    if (tracking.visitorId) params.set("visitorId", tracking.visitorId);
    if (tracking.sessionId) params.set("sessionId", tracking.sessionId);
    params.set("doNotTrack", tracking.doNotTrack ? "true" : "false");
  }

  function getCampaignsEndpoint(apiBaseUrl) {
    var value = String(apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/promo-pulse";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function renderCampaign(campaign) {
    var design = campaign.design || {};
    var slotId = "promo-pulse-free-shipping-" + campaign.placement;
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

    if (!window.CountPulseSurface) {
      updateDebug(root, "Surface module no disponible todavia.");
      return;
    }

    container = getPlacementContainer(campaign.placement);
    if (existing) {
      // Rebuild the whole bar so EVERY dynamic variable re-resolves with the new
      // cart (remaining_amount, cart_subtotal, progress_percent, and any token in
      // the headline / custom HTML text), not just the body + progress bar.
      bar = buildBar(campaign);
      bar.id = slotId;
      existing.replaceWith(bar);
      syncStickyContainer(container);
      startCountdown(bar, campaign);
      emitImpressionOnce(campaign);
      return;
    }

    bar = buildBar(campaign);
    bar.id = slotId;
    container.appendChild(bar);
    syncStickyContainer(container);
    startCountdown(bar, campaign);
    emitImpressionOnce(campaign);
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
    var texts = campaign.texts || {};
    var progress = calculateProgress(campaign);
    var timerState = calculateTimerState(campaign, new Date());

    var couponNode = null;
    if (
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.PromoPulseCouponButton === "function"
    ) {
      couponNode = window.PromoPulseCouponButton(
        campaign.discount.discountCode,
        campaign,
      );
    }

    var progressSpec =
      design.showProgressBar !== false
        ? {
            percentage: Math.max(0, Math.min(100, progress.percentage)),
            style: readProgressStyle(campaign),
            unlocked: progress.unlocked,
          }
        : null;

    var variant =
      campaign.placement === "TOP_BAR" || campaign.placement === "BOTTOM_BAR"
        ? "bar"
        : "block";

    var bar = window.CountPulseSurface.build({
      tracking: {
        campaignId: campaign.id,
        experimentId: campaign.experimentId || null,
        variantId: campaign.variantId || null,
        placement: campaign.placement,
      },
      variant: variant,
      placement: campaign.placement,
      design: design,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: config.locale,
      variables: freeShippingVars(campaign, progress),
      headline: texts.headline || "Free shipping",
      body: buildMessage(campaign, progress),
      timer: {
        isActive: timerState.isActive,
        isExpired: timerState.isExpired,
        remainingMs: timerState.remainingMs,
      },
      hasTimer: timerState.isActive,
      couponNode: couponNode,
      cta: design.showButton !== false ? texts.ctaText || "" : "",
      ctaUrl: texts.ctaUrl || "",
      progress: progressSpec,
      dataTestId: "promo-bar",
      onClose: function () {
        removeBar(bar, design);
      },
    });

    bar.dataset.campaignId = campaign.id;
    if (
      (campaign.placement === "TOP_BAR" ||
        campaign.placement === "BOTTOM_BAR") &&
      design.positionMode !== "OVERLAY" &&
      design.positionSticky
    ) {
      bar.classList.add("counterpulse-preview-promo--sticky");
      bar.dataset.ppStickyZIndex = String(readStickyZIndex(design));
    }

    return bar;
  }

  // Canonical free-shipping message variables (mirrors buildFreeShippingVariables
  // in app/lib/free-shipping.ts and the preview).
  function freeShippingVars(campaign, progress) {
    var currency = (campaign.freeShipping || {}).currencyCode;
    var pct = Math.round(progress.percentage);
    return {
      remaining_amount: money(progress.amountRemaining, currency),
      cart_subtotal: money(progress.cartSubtotal, currency),
      threshold_amount: money(
        Number((campaign.freeShipping || {}).thresholdAmount || 0),
        currency,
      ),
      progress_percent: pct + "%",
      remaining_percent: Math.max(0, 100 - pct) + "%",
    };
  }

  // Replaces every free-shipping token in a template (not just remaining_amount),
  // so the body resolves the same way on initial render and on cart updates.
  function interpolateFreeShipping(template, vars) {
    return String(template || "").replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      function (match, key) {
        return Object.prototype.hasOwnProperty.call(vars, key)
          ? vars[key]
          : match;
      },
    );
  }

  function buildMessage(campaign, progress) {
    var texts = campaign.texts || {};
    var settings = campaign.freeShipping || {};
    var vars = freeShippingVars(campaign, progress);

    if (progress.cartSubtotal <= 0) {
      return (
        texts.freeShippingEmptyText ||
        settings.emptyCartMessage ||
        interpolateFreeShipping(
          texts.freeShippingProgressText ||
            "You're {{remaining_amount}} away from free shipping",
          vars,
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

    return interpolateFreeShipping(
      texts.freeShippingProgressText ||
        "You're {{remaining_amount}} away from free shipping",
      vars,
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

  function startCountdown(bar, campaign) {
    if (!bar.querySelector("[data-cp-timer]")) return;

    bar.__promoPulseTimerInterval = window.setInterval(function () {
      var state = calculateTimerState(campaign, new Date());
      var countdowns = bar.querySelectorAll("[data-cp-timer]");
      var design = campaign.design || {};

      if (!countdowns.length) return;

      if (state.isExpired) {
        Array.prototype.forEach.call(countdowns, function (node) {
          node.remove();
        });
        bar.classList.add("counterpulse-preview-promo--expired");

        if (shouldHideExpiredCampaign(campaign)) {
          removeBar(bar, design);
        }
        return;
      }

      Array.prototype.forEach.call(countdowns, function (node) {
        window.CountPulseSurface.updateTimer(node, state.remainingMs, design);
      });
    }, 1000);
  }

  function calculateTimerState(campaign, now) {
    var timer = campaign.timer || {};
    var mode = timer.mode || "FIXED_DATE";

    if (mode === "EVERGREEN_SESSION")
      return calculateEvergreenTimer(campaign, now);
    if (mode === "RECURRING_DAILY") return calculateDailyTimer(timer, now);

    return remainingUntil(now, parseDate(campaign.endsAt));
  }

  function calculateEvergreenTimer(campaign, now) {
    var timer = campaign.timer || {};
    var duration = Number(timer.durationMinutes);
    var storage =
      timer.resetBehavior === "NEVER" ? localStorage : sessionStorage;
    var key = "promo_pulse_deadline_" + campaign.id;
    var saved = readStoredTimer(storage, key);
    var endsAt = parseDate(saved && saved.endsAt);

    if (endsAt && endsAt.getTime() > now.getTime()) {
      return remainingUntil(now, endsAt);
    }

    if (!Number.isFinite(duration) || duration <= 0) return emptyTimerState();

    endsAt = new Date(now.getTime() + Math.round(duration) * 60000);
    writeStoredTimer(storage, key, { endsAt: endsAt.toISOString() });

    return remainingUntil(now, endsAt);
  }

  function calculateDailyTimer(timer, now) {
    var hour = clamp(timer.cutoffHour, 0, 23, 23);
    var minute = clamp(timer.cutoffMinute, 0, 59, 59);
    var endsAt = new Date(now);

    endsAt.setHours(hour, minute, 0, 0);
    if (endsAt.getTime() <= now.getTime()) {
      endsAt.setDate(endsAt.getDate() + 1);
    }

    return remainingUntil(now, endsAt);
  }

  function remainingUntil(now, endsAt) {
    if (!endsAt) return emptyTimerState();

    var remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
    var expired = remainingMs <= 0;

    return {
      isActive: !expired,
      isExpired: expired,
      remainingMs: remainingMs,
      endsAt: endsAt,
    };
  }

  function emptyTimerState() {
    return { isActive: false, isExpired: false, remainingMs: 0, endsAt: null };
  }

  function readStoredTimer(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function writeStoredTimer(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function shouldHideExpiredCampaign(campaign) {
    var behavior = ((campaign.timer || {}).expiredBehavior || "").toUpperCase();

    return behavior === "HIDE_TIMER" || behavior === "UNPUBLISH_TIMER";
  }

  function readProgressStyle(campaign) {
    var style = String(
      (campaign.freeShipping || {}).progressStyle || "BAR",
    ).toUpperCase();

    return style === "COMPACT" || style === "CIRCULAR" ? style : "BAR";
  }

  function getPlacementContainer(placement) {
    var id = placement === "BOTTOM_BAR" ? "pp-bottom-bars" : "pp-top-bars";
    var existing = document.getElementById(id);
    var container;
    var configuredTarget;

    if (existing) return existing;

    configuredTarget = querySelectorList(getConfiguredSelector(placement));
    container = document.createElement("div");
    container.id = id;
    container.className =
      "pp-container pp-container--" + placement.toLowerCase().replace("_", "-");

    if (placement === "BOTTOM_BAR") {
      (configuredTarget || document.body).appendChild(container);
    } else if (configuredTarget) {
      configuredTarget.insertBefore(container, configuredTarget.firstChild);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }

    return container;
  }

  function getConfiguredSelector(placement) {
    var settings = window.PromoPulseSettings || {};
    var key =
      placement === "TOP_BAR"
        ? "customTopBarSelector"
        : placement === "BOTTOM_BAR"
          ? "customBottomBarSelector"
          : "";
    if (!key) return "";

    if (
      settings.separateMobileSelectors &&
      config.device === "mobile" &&
      settings.mobileSelectors &&
      settings.mobileSelectors[key]
    ) {
      return settings.mobileSelectors[key];
    }

    return settings[key] || "";
  }

  function querySelectorList(selector) {
    var selectors;
    var index;
    var currentSelector;
    var target;

    if (!selector || typeof selector !== "string") return null;

    selectors = selector
      .split(",")
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean);

    for (index = 0; index < selectors.length; index += 1) {
      currentSelector = selectors[index];

      try {
        target = document.querySelector(currentSelector);
        if (target) return target;
      } catch (error) {
        debug("Invalid selector", currentSelector, error);
      }
    }

    return null;
  }

  function installCartChangeWatcher() {
    if (window.PromoPulseCartWatcherReady) return;

    window.PromoPulseCartWatcherReady = true;

    if (window.fetch) {
      var nativeFetch = window.fetch;

      window.fetch = function (input, init) {
        var shouldNotify = isCartMutationRequest(input, init);

        return nativeFetch.apply(this, arguments).then(function (response) {
          if (shouldNotify && response && response.ok) {
            updateCartStateFromResponse(response).then(function (cartState) {
              notifyCartChanged(!cartState);
            });
          }

          return response;
        });
      };
    }

    if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
      var nativeOpen = window.XMLHttpRequest.prototype.open;
      var nativeSend = window.XMLHttpRequest.prototype.send;

      window.XMLHttpRequest.prototype.open = function (method, url) {
        this.__promoPulseCartMutation = isCartMutation(method, url);
        return nativeOpen.apply(this, arguments);
      };

      window.XMLHttpRequest.prototype.send = function () {
        if (this.__promoPulseCartMutation) {
          this.addEventListener("loadend", function () {
            if (this.status >= 200 && this.status < 400) {
              notifyCartChanged(!updateCartStateFromText(this.responseText));
            }
          });
        }

        return nativeSend.apply(this, arguments);
      };
    }
  }

  function notifyCartChanged(forceCartFetch) {
    if (typeof window.PromoPulseClearRequestCache === "function") {
      window.PromoPulseClearRequestCache("cart");
    }
    if (forceCartFetch && window.PromoPulseCartState) {
      window.PromoPulseCartState.updatedAt = 0;
    }

    window.clearTimeout(window.PromoPulseCartChangedTimer);
    window.PromoPulseCartChangedTimer = window.setTimeout(function () {
      document.dispatchEvent(new CustomEvent("promo-pulse:cart-changed"));
    }, 120);
  }

  function isCartMutationRequest(input, init) {
    var method = (init && init.method) || (input && input.method) || "GET";
    var url = typeof input === "string" ? input : input && input.url;

    return isCartMutation(method, url);
  }

  function isCartMutation(method, url) {
    var pathname;

    if (String(method || "GET").toUpperCase() === "GET") return false;

    try {
      pathname = new URL(url || "", window.location.href).pathname;
    } catch (error) {
      return false;
    }

    // Match cart routes even when the storefront prefixes them with a locale or
    // market path (e.g. /en-gb/cart/add.js), so "Add to cart" is detected on
    // localized stores, not only /cart/add.js.
    return /(^|\/)cart\/(add|change|update|clear)(\.js)?$/.test(pathname);
  }

  function readAjaxCartState() {
    var recentCartState = readRecentCartState();

    if (recentCartState) {
      return Promise.resolve(recentCartState);
    }

    if (isPaused("PromoPulseCartPausedUntil")) {
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
        updateCartState(cart);

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

  function updateCartStateFromResponse(response) {
    try {
      return response
        .clone()
        .json()
        .then(updateCartState)
        .catch(function () {
          return null;
        });
    } catch (error) {
      return Promise.resolve(null);
    }
  }

  function updateCartStateFromText(value) {
    try {
      return updateCartState(JSON.parse(value || "null"));
    } catch (error) {
      return null;
    }
  }

  function updateCartState(cart) {
    if (typeof window.PromoPulseUpdateCartState === "function") {
      return window.PromoPulseUpdateCartState(cart);
    }

    if (!cart || typeof cart.total_price !== "number") return null;

    window.PromoPulseCartSubtotal = cart.total_price / 100;
    window.PromoPulseCartCurrency =
      cart.currency || window.PromoPulseCartCurrency || "";
    window.PromoPulseCartToken = cart.token || window.PromoPulseCartToken || "";
    window.PromoPulseCartState = {
      subtotal: window.PromoPulseCartSubtotal,
      currency: window.PromoPulseCartCurrency,
      token: window.PromoPulseCartToken,
      updatedAt: Date.now(),
    };

    return window.PromoPulseCartState;
  }

  function readRecentCartState() {
    if (typeof window.PromoPulseGetCartState !== "function") return null;

    return window.PromoPulseGetCartState(2500);
  }

  function assertCartJsonResponse(response) {
    var contentType = response.headers.get("content-type") || "";

    if (
      response.redirected ||
      response.url.indexOf("/password") !== -1 ||
      contentType.indexOf("application/json") === -1
    ) {
      pauseRequests("PromoPulseCartPausedUntil", cartPauseMs);
      throw new Error(
        "Expected JSON from /cart.js but received storefront HTML.",
      );
    }
  }

  function readCartSubtotal(element) {
    var cents = Number(element.dataset.cartTotalCents);
    if (Number.isFinite(cents)) return cents / 100;
    if (typeof window.PromoPulseCartSubtotal === "number") {
      return window.PromoPulseCartSubtotal;
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
      window.PromoPulseCartCurrency ||
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
      ""
    );
  }

  function detectDevice() {
    if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
    if (window.matchMedia("(max-width: 1024px)").matches) return "tablet";
    return "desktop";
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

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function removeBar(bar, design) {
    var duration = clamp((design || {}).animationDurationMs, 0, 1500, 220);
    var parent;

    if (
      !(design || {}).exitAnimation ||
      (design || {}).exitAnimation === "NONE" ||
      duration === 0
    ) {
      parent = bar.parentNode;
      bar.remove();
      syncStickyContainer(parent);
      return;
    }

    bar.classList.add("pp-bar--closing");
    window.setTimeout(function () {
      parent = bar.parentNode;
      bar.remove();
      syncStickyContainer(parent);
    }, duration);
  }

  function readStickyZIndex(design) {
    return clamp((design || {}).positionStickyZIndex, 0, 2147483647, 50);
  }

  function syncStickyContainer(container) {
    var stickyBars;
    var zIndex = null;

    if (!container || !container.classList) return;
    if (!container.classList.contains("pp-container")) return;

    stickyBars = container.querySelectorAll("[data-pp-sticky-z-index]");
    Array.prototype.forEach.call(stickyBars, function (bar) {
      var value = Number(bar.dataset.ppStickyZIndex);
      if (!Number.isFinite(value)) {
        value = Number(
          window.getComputedStyle(bar).getPropertyValue("--cp-sticky-z-index"),
        );
      }
      if (!Number.isFinite(value)) value = 50;
      value = Math.max(0, Math.round(value));
      zIndex = zIndex === null ? value : Math.max(zIndex, value);
    });

    if (zIndex === null) {
      container.classList.remove("pp-container--sticky");
      container.style.removeProperty("--pp-sticky-z-index");
      return;
    }

    container.classList.add("pp-container--sticky");
    container.style.setProperty("--pp-sticky-z-index", String(zIndex));
  }

  function emitImpression(campaign) {
    document.dispatchEvent(
      new CustomEvent("promo-pulse:impression", {
        detail: {
          campaignId: campaign.id,
          experimentId: campaign.experimentId || null,
          variantId: campaign.variantId || null,
          placement: campaign.placement,
        },
      }),
    );
  }

  function emitImpressionOnce(campaign) {
    var key = campaign.placement + ":" + campaign.id;

    if (trackedImpressions[key]) return;

    trackedImpressions[key] = true;
    emitImpression(campaign);
  }

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, Math.round(number)))
      : fallback;
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

  function applyStorefrontSettings(configOrSettings, maybeSettings) {
    var settings = maybeSettings || configOrSettings;

    if (!settings || typeof settings !== "object") return;

    window.PromoPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;
    config.currency = config.currency || settings.defaultCurrency || "";
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
