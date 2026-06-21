(function () {
  "use strict";

  if (window.PromoPulseCartTimer && window.PromoPulseCartTimer.init) {
    window.PromoPulseCartTimer.init();
    return;
  }

  var drawerSelectors = [
    "cart-drawer",
    "#CartDrawer",
    ".drawer__contents",
    'form[action="/cart"]',
  ];
  var drawerObserverStarted = false;
  var drawerInternalUpdate = false;
  var drawerRenderTimer = 0;
  var drawerRequestInFlight = false;
  var drawerLastRequestAt = 0;
  var drawerMinimumRequestGapMs = 2000;
  var proxyPauseMs = 60000;
  var cartPauseMs = 30000;

  window.PromoPulseCartTimer = { init: init };

  init();
  document.addEventListener("shopify:section:load", init);
  document.addEventListener("cart:updated", function () {
    scheduleDrawerRender(true);
  });

  function init() {
    initCartPageBlocks();
    initDrawerSupport();
  }

  function initCartPageBlocks() {
    [].slice
      .call(document.querySelectorAll(".pp-cart-timer"))
      .forEach(function (root) {
        if (root.dataset.ppInitialized === "true") return;
        root.dataset.ppInitialized = "true";
        initCartPageBlock(root);
      });
  }

  function initCartPageBlock(root) {
    var config = readBlockConfig(root, "CART_PAGE");

    if (!config.shop) {
      updateDebug(root, "Detenido: falta el shop domain en el bloque.");
      return;
    }
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && !config.campaignId) {
      updateDebug(
        root,
        "Detenido: el modo Specific campaign requiere un Campaign ID.",
      );
      return;
    }

    fetchCampaigns(config, root)
      .then(function (campaigns) {
        if (campaigns[0]) {
          renderCartCampaign(root, campaigns[0], config, false);
        } else {
          updateDebug(
            root,
            "API OK: 0 campanas elegibles para CART_PAGE. Revisa placement, status ACTIVE, targeting, fechas y tipo CART_TIMER/FREE_SHIPPING_GOAL.",
          );
        }
      })
      .catch(function (error) {
        updateDebug(root, "Error consultando la API: " + error.message);
        debug(config, "[CP cart]", error);
      });
  }

  function initDrawerSupport() {
    if (drawerObserverStarted) return;
    if (window.location.pathname.replace(/\/$/, "") === "/cart") return;

    drawerObserverStarted = true;
    scheduleDrawerRender();
    updateDebug(
      document.getElementById("promo-pulse-app-embed"),
      "Soporte CART_DRAWER activo. Observando apertura/cambios del drawer.",
    );

    new MutationObserver(function (mutations) {
      if (drawerInternalUpdate || !hasExternalDrawerMutation(mutations)) return;
      scheduleDrawerRender(false);
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function scheduleDrawerRender(force) {
    if (!drawerObserverStarted) return;
    if (!force && drawerRequestInFlight) return;

    window.clearTimeout(drawerRenderTimer);
    drawerRenderTimer = window.setTimeout(
      function () {
        renderDrawerCampaign(!!force);
      },
      force ? 80 : 300,
    );
  }

  function renderDrawerCampaign(force) {
    var embed = document.getElementById("promo-pulse-app-embed");
    var config;
    var now = Date.now();

    if (!embed) return;
    if (!force && now - drawerLastRequestAt < drawerMinimumRequestGapMs) return;
    if (drawerRequestInFlight) return;

    config = readEmbedConfig(embed, "CART_DRAWER");
    if (!config.shop) {
      updateDebug(embed, "Cart drawer detenido: falta el shop domain.");
      return;
    }

    drawerRequestInFlight = true;
    drawerLastRequestAt = now;

    readAjaxCartState()
      .then(function (cartState) {
        config.cartSubtotal = cartState.subtotal;
        config.currency = cartState.currency || config.currency;
        config.cartToken = cartState.token || config.cartToken;
        return fetchCampaigns(config, embed);
      })
      .then(function (campaigns) {
        var campaign = campaigns[0];
        var target = campaign ? findDrawerTarget(campaign, config) : null;
        var slot;

        if (!campaign) {
          updateDebug(
            embed,
            "API OK: 0 campanas elegibles para CART_DRAWER. Crea una campana activa con placement CART_DRAWER.",
          );
          return;
        }
        if (!target) {
          updateDebug(
            embed,
            "Campana CART_DRAWER recibida, pero no se encontro ningun selector de drawer. Configura customCartDrawerSelector en Settings.",
          );
          return;
        }

        drawerInternalUpdate = true;
        slot = ensureDrawerSlot(target);
        renderCartCampaign(slot, campaign, config, true);
        updateDebug(
          embed,
          "CART_DRAWER renderizado en selector compatible. Campaign ID: " +
            campaign.id,
        );
        window.setTimeout(function () {
          drawerInternalUpdate = false;
        }, 0);
      })
      .catch(function (error) {
        updateDebug(embed, "Error en CART_DRAWER: " + error.message);
        debug(config, "[CP drawer]", error);
      })
      .finally(function () {
        drawerRequestInFlight = false;
      });
  }

  function readBlockConfig(root, placement) {
    var subtotal = centsToAmount(root.dataset.cartTotalCents);

    return {
      shop: root.dataset.shop || detectShop(),
      path: window.location.pathname,
      locale: root.dataset.locale || detectLocale(),
      country: root.dataset.country || "",
      market: root.dataset.market || detectMarket(),
      placement: placement,
      cartSubtotal: subtotal,
      currency: root.dataset.cartCurrency || detectCurrency(),
      cartToken: root.dataset.cartToken || "",
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      alignment: root.dataset.alignment || "CENTER",
      compactMode: root.dataset.compact === "true",
      showIcon: root.dataset.showIcon !== "false",
      debugMode: root.dataset.debug === "true",
      customCartDrawerSelector: root.dataset.customCartDrawerSelector || "",
      apiBaseUrl:
        root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };
  }

  function readEmbedConfig(root, placement) {
    return {
      shop: root.dataset.shop || detectShop(),
      path: window.location.pathname,
      locale:
        root.dataset.locale || root.dataset.defaultLocale || detectLocale(),
      country: root.dataset.country || "",
      market: root.dataset.market || detectMarket(),
      placement: placement,
      cartSubtotal: detectWindowCartSubtotal(),
      currency: detectCurrency(),
      cartToken: "",
      campaignId: "",
      fallbackMode: "AUTO_ELIGIBLE",
      alignment: "CENTER",
      compactMode: false,
      showIcon: true,
      debugMode: root.dataset.debug === "true",
      customCartDrawerSelector: root.dataset.customCartDrawerSelector || "",
      apiBaseUrl:
        root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };
  }

  function fetchCampaigns(config, debugRoot) {
    var url = buildCampaignUrl(config);

    if (isPaused("PromoPulseProxyPausedUntil")) {
      updateDebug(
        debugRoot,
        "App Proxy pausado temporalmente porque Shopify devolvio password/HTML en una llamada anterior.",
        url,
      );
      return Promise.resolve([]);
    }

    updateDebug(
      debugRoot,
      "Consultando campanas " + config.placement + " elegibles.",
      url,
    );

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
        applyStorefrontSettings(config, payload.settings);
        var campaigns = Array.isArray(payload.campaigns)
          ? payload.campaigns.map(applyExperiment)
          : [];
        updateDebug(
          debugRoot,
          "API OK: " +
            campaigns.length +
            " campana(s) elegibles para " +
            config.placement +
            ".",
          url,
        );
        return campaigns;
      })
      .catch(function (error) {
        updateDebug(
          debugRoot,
          "Error consultando " + config.placement + ": " + error.message,
          url,
        );
        throw error;
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

  function buildCampaignUrl(config) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: config.path,
      locale: config.locale,
      placement: config.placement,
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.cartSubtotal !== null) {
      params.set("cartSubtotal", String(config.cartSubtotal));
    }
    if (config.currency) params.set("currency", config.currency);
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && config.campaignId) {
      params.set("campaignId", config.campaignId);
    }
    appendBehaviorTargetingParams(params);

    return getCampaignsEndpoint(config.apiBaseUrl) + "?" + params.toString();
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

    if (!/^https?:\/\//i.test(value)) return "/apps/promo-pulse";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function renderCartCampaign(root, campaign, config, isDrawer) {
    var timerState = calculateTimerState(campaign, new Date(), config);
    var texts = campaign.texts || {};
    var card;

    if (timerState.isExpired && shouldHideExpiredCampaign(campaign)) {
      updateDebug(
        root,
        "Campana recibida, pero el timer expiro y debe ocultarse.",
      );
      return;
    }
    if (
      campaign.design &&
      campaign.design.mobileEnabled === false &&
      detectDevice() === "mobile"
    ) {
      updateDebug(
        root,
        "Campana recibida, pero mobileEnabled=false y el dispositivo detectado es mobile.",
      );
      return;
    }

    card = document.createElement("section");
    card.className =
      "pp-cart-card" +
      (config.compactMode ? " pp-cart-card--compact" : "") +
      (isDrawer ? " pp-cart-card--drawer" : "");
    applyMotionClasses(card, campaign.design || {});
    card.dataset.campaignId = campaign.id;
    if (isDrawer) {
      card.dataset.testid = "cart-drawer-widget";
    }
    card.setAttribute("role", "region");
    card.setAttribute(
      "aria-label",
      (texts.headline || defaultHeadline(campaign)).trim(),
    );
    setDesign(card, campaign.design || {}, config.alignment);

    if (config.showIcon) {
      var icon = renderCampaignIcon(campaign);
      if (icon) card.appendChild(icon);
    }

    card.appendChild(renderMessage(campaign, timerState, config));

    if (campaign.type === "FREE_SHIPPING_GOAL") {
      card.appendChild(renderFreeShippingProgress(campaign, config));
    }

    if (
      !timerState.isExpired &&
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.CPcb === "function"
    ) {
      card.appendChild(window.CPcb(campaign.discount.discountCode, campaign));
    }

    if (!timerState.isExpired && (campaign.design || {}).showButton !== false) {
      renderCta(campaign).forEach(function (cta) {
        card.appendChild(cta);
      });
    }

    root.replaceChildren(card);
    tick(card, campaign, config);
    emitImpression(campaign);
  }

  function updateDebug(root, message, url) {
    var status;
    var endpoint;

    if (!root || root.dataset.debug !== "true") return;

    drawerInternalUpdate = true;
    status = root.querySelector("[data-pp-debug-status]");
    endpoint = root.querySelector("[data-pp-debug-url]");

    if (status) status.textContent = message;
    if (endpoint && url) endpoint.textContent = url;
    window.setTimeout(function () {
      drawerInternalUpdate = false;
    }, 0);
  }

  function hasExternalDrawerMutation(mutations) {
    return mutations.some(function (mutation) {
      if (!isInternalNode(mutation.target)) return true;

      return [].slice.call(mutation.addedNodes).some(function (node) {
        return !isInternalNode(node);
      });
    });
  }

  function isInternalNode(node) {
    var element;

    if (!node) return true;
    if (node.nodeType === 3) {
      element = node.parentElement;
    } else if (node.nodeType === 1) {
      element = node;
    } else {
      return true;
    }

    if (!element || !element.closest) return true;

    return !!element.closest(
      "#promo-pulse-app-embed, .pp-debug, #promo-pulse-cart-drawer-slot, .pp-cart-drawer-slot, .pp-container, .pp-cart-card",
    );
  }

  function renderMessage(campaign, timerState, config) {
    var texts = campaign.texts || {};
    var message = document.createElement("div");
    var headline = texts.headline || defaultHeadline(campaign);
    var detail = texts.subheadline || "";

    message.className = "pp-message";

    if (campaign.type === "FREE_SHIPPING_GOAL") {
      detail = buildFreeShippingText(campaign, config) || detail;
    }

    if (timerState.isExpired && texts.expiredText) {
      detail = texts.expiredText;
    }

    message.appendChild(node("strong", "", headline));
    if (detail) message.appendChild(node("span", "", detail));
    if (timerState.isActive) {
      message.appendChild(
        renderCountdown(timerState.remainingMs, campaign.design || {}),
      );
    }

    return message;
  }

  function renderFreeShippingProgress(campaign, config) {
    var threshold = Number((campaign.freeShipping || {}).thresholdAmount || 0);
    var subtotal = Number(config.cartSubtotal || 0);
    var progress =
      threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 0;
    var wrapper = document.createElement("div");
    var label = document.createElement("span");
    var track = document.createElement("span");
    var fill = document.createElement("span");

    wrapper.className = "pp-cart-progress";
    label.className = "pp-cart-progress__label";
    label.textContent = buildFreeShippingText(campaign, config) || "";
    track.className = "pp-progress__track";
    track.dataset.testid = "free-shipping-progress";
    track.setAttribute("role", "progressbar");
    track.setAttribute(
      "aria-label",
      label.textContent || "Free shipping progress",
    );
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.round(progress)));
    fill.className = "pp-progress__fill";
    fill.style.width = Math.max(0, progress) + "%";

    track.appendChild(fill);
    if (label.textContent) wrapper.appendChild(label);
    wrapper.appendChild(track);

    return wrapper;
  }

  function renderCta(campaign) {
    var texts = campaign.texts || {};
    var label = texts.ctaText;
    var url = texts.ctaUrl;
    var ctas = [];

    if (!label && campaign.type === "CART_TIMER") {
      label = "Checkout";
      url = "/checkout";
    }

    if (label) {
      ctas.push(link("pp-cta", label, isSafeUrl(url) ? url : "#"));
    }

    return ctas;
  }

  function renderCountdown(ms, design) {
    var countdown = node(
      "span",
      "pp-countdown" + timerTickClass(design),
      formatTime(ms, design),
    );

    countdown.setAttribute("aria-live", "polite");
    countdown.setAttribute("aria-label", "Time remaining");

    return countdown;
  }

  function getExpiredBehavior(campaign) {
    return (campaign.timer || {}).expiredBehavior || "UNPUBLISH_TIMER";
  }

  function shouldHideExpiredCampaign(campaign) {
    var behavior = getExpiredBehavior(campaign);
    return behavior === "UNPUBLISH_TIMER" || behavior === "HIDE_TIMER";
  }

  function tick(card, campaign, config) {
    if (!card.querySelector(".pp-countdown")) return;

    window.setInterval(function () {
      var state = calculateTimerState(campaign, new Date(), config);
      var countdown = card.querySelector(".pp-countdown");
      var subheadline = card.querySelector(
        ".pp-message span:not(.pp-countdown)",
      );
      var expiredText = (campaign.texts || {}).expiredText || "";
      var expiredBehavior = getExpiredBehavior(campaign);

      if (!countdown) return;
      if (state.isExpired) {
        countdown.remove();
        card.classList.add("pp-bar--expired");
        if (expiredBehavior === "SHOW_CUSTOM_TITLE" && expiredText) {
          if (subheadline) subheadline.textContent = expiredText;
        } else if (
          expiredBehavior === "HIDE_TIMER" ||
          expiredBehavior === "UNPUBLISH_TIMER"
        ) {
          card.remove();
        }
        return;
      }

      var nextText = formatTime(state.remainingMs, campaign.design || {});
      if (countdown.textContent !== nextText) {
        countdown.textContent = nextText;
        replayCountdownTick(countdown);
      }
    }, 1000);
  }

  function calculateTimerState(campaign, now, config) {
    var timer = campaign.timer || {};

    if (timer.mode === "EVERGREEN_SESSION" || campaign.type === "CART_TIMER") {
      return calculateCartReserveTimer(campaign, now, config);
    }

    return buildTimerState(now, parseDate(campaign.endsAt));
  }

  function calculateCartReserveTimer(campaign, now, config) {
    var timer = campaign.timer || {};
    var duration = Number(timer.durationMinutes);
    var storage = safeStorage(
      timer.resetBehavior === "ON_SESSION_END"
        ? "sessionStorage"
        : "localStorage",
    );
    var token = config.cartToken || "session";
    var key = "promo_pulse_cart_deadline_" + campaign.id + "_" + token;
    var stored = readStorage(storage, key);
    var startedAt = parseDate(stored && stored.startedAt);
    var endsAt = parseDate(stored && stored.endsAt);

    if (startedAt && endsAt) {
      if (endsAt.getTime() > now.getTime()) {
        return buildTimerState(now, endsAt);
      }

      if (
        timer.resetBehavior === "NEVER" ||
        timer.expiredBehavior !== "REPEAT_COUNTDOWN"
      ) {
        return buildTimerState(now, endsAt);
      }
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      return buildTimerState(now, parseDate(campaign.endsAt));
    }

    endsAt = new Date(now.getTime() + Math.round(duration) * 60000);
    writeStorage(storage, key, {
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    return buildTimerState(now, endsAt);
  }

  function buildTimerState(now, endsAt) {
    var expired;

    if (!endsAt) return { isActive: false, isExpired: false, remainingMs: 0 };

    expired = endsAt.getTime() <= now.getTime();

    return {
      isActive: !expired,
      isExpired: expired,
      remainingMs: Math.max(0, endsAt.getTime() - now.getTime()),
    };
  }

  function findDrawerTarget(campaign, config) {
    var selectors = [];
    var index;
    var target;

    if (campaign.placementSelector) selectors.push(campaign.placementSelector);
    if (config && config.customCartDrawerSelector) {
      selectors.push(config.customCartDrawerSelector);
    }
    selectors = selectors.concat(drawerSelectors);

    for (index = 0; index < selectors.length; index += 1) {
      target = safeQuerySelector(selectors[index]);
      if (target) return target;
    }

    return null;
  }

  function ensureDrawerSlot(target) {
    var existing = document.getElementById("promo-pulse-cart-drawer-slot");
    var slot = existing || document.createElement("div");

    if (existing && existing.parentElement !== target) existing.remove();

    slot.id = "promo-pulse-cart-drawer-slot";
    slot.className = "pp-cart-drawer-slot";
    slot.dataset.testid = "cart-drawer-widget";

    if (!slot.parentElement) {
      target.insertBefore(slot, target.firstChild);
    }

    return slot;
  }

  function readAjaxCartState() {
    if (isPaused("PromoPulseCartPausedUntil")) {
      return Promise.resolve({
        subtotal: detectWindowCartSubtotal(),
        currency: window.PromoPulseCartCurrency || "",
        token: "",
      });
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
              : detectWindowCartSubtotal(),
          currency: cart.currency || "",
          token: cart.token || "",
        };
      })
      .catch(function () {
        return {
          subtotal: detectWindowCartSubtotal(),
          currency: window.PromoPulseCartCurrency || "",
          token: "",
        };
      });
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

  function buildFreeShippingText(campaign, config) {
    var texts = campaign.texts || {};
    var settings = campaign.freeShipping || {};
    var subtotal = config ? Number(config.cartSubtotal || 0) : 0;
    var threshold = Number(settings.thresholdAmount || 0);
    var remaining = Math.max(0, threshold - subtotal);
    var amount = money(remaining, config && config.currency);
    var progressText = "You're {{amount}} away from free shipping";
    var template;

    if (subtotal <= 0) {
      template =
        texts.freeShippingEmptyText ||
        settings.emptyCartMessage ||
        texts.freeShippingProgressText ||
        progressText;
    } else if (remaining <= 0) {
      template =
        texts.freeShippingSuccessText ||
        settings.successMessage ||
        "You've unlocked free shipping!";
    } else {
      template = texts.freeShippingProgressText || progressText;
    }

    return template
      .replace(/\{\{\s*amount\s*\}\}/g, amount)
      .replace(/\{\{\s*remaining\s*\}\}/g, amount)
      .replace(/\{\{\s*remaining_amount\s*\}\}/g, amount);
  }

  function setDesign(element, design, alignment) {
    element.style.setProperty("--pp-bg", getBackground(design));
    element.style.setProperty(
      "--pp-text",
      safeColor(design.textColor, "#ffffff"),
    );
    element.style.setProperty(
      "--pp-accent",
      safeColor(design.accentColor, "#22c55e"),
    );
    element.style.setProperty(
      "--pp-button",
      safeColor(design.buttonColor, "#ffffff"),
    );
    element.style.setProperty(
      "--pp-button-text",
      safeColor(design.buttonTextColor, "#111827"),
    );
    element.style.setProperty(
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 14) + "px",
    );
    element.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 24, 4) + "px",
    );
    element.style.setProperty(
      "--pp-content-max-width",
      clamp(design.contentMaxWidth, 280, 1440, 960) + "px",
    );
    element.style.setProperty(
      "--pp-padding-block",
      clamp(design.paddingBlock, 4, 48, 12) + "px",
    );
    element.style.setProperty(
      "--pp-padding-inline",
      clamp(design.paddingInline, 8, 64, 14) + "px",
    );
    element.style.setProperty(
      "--pp-justify",
      justify(alignment || design.alignment),
    );
    element.style.setProperty(
      "--pp-align",
      align(alignment || design.alignment),
    );
    element.style.setProperty(
      "--pp-motion-duration",
      clamp(design.animationDurationMs, 0, 1500, 220) + "ms",
    );
  }

  function applyMotionClasses(element, design) {
    if (design.entranceAnimation && design.entranceAnimation !== "NONE") {
      element.classList.add(
        "pp-surface--enter-" + String(design.entranceAnimation).toLowerCase(),
      );
    }
  }

  function timerTickClass(design) {
    return design.timerTickAnimation && design.timerTickAnimation !== "NONE"
      ? " pp-countdown--tick-" + String(design.timerTickAnimation).toLowerCase()
      : "";
  }

  function replayCountdownTick(countdown) {
    if (
      !countdown ||
      !/\bpp-countdown--tick-(fade|flip|pulse)\b/.test(countdown.className)
    ) {
      return;
    }

    countdown.classList.remove("pp-countdown--ticking");
    void countdown.offsetWidth;
    countdown.classList.add("pp-countdown--ticking");
  }

  function detectShop() {
    return (window.Shopify && window.Shopify.shop) || window.location.hostname;
  }

  function detectLocale() {
    return document.documentElement.lang || window.navigator.language || "en";
  }

  function detectMarket() {
    var shopifyMarket = window.Shopify && window.Shopify.market;

    return (
      (shopifyMarket &&
        (shopifyMarket.handle || shopifyMarket.id || shopifyMarket)) ||
      ""
    );
  }

  function detectCurrency() {
    return (
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

  function detectWindowCartSubtotal() {
    return typeof window.PromoPulseCartSubtotal === "number"
      ? window.PromoPulseCartSubtotal
      : null;
  }

  function centsToAmount(value) {
    var cents = Number(value);
    return Number.isFinite(cents) ? cents / 100 : null;
  }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(amount);
    } catch {
      return String(amount.toFixed(2));
    }
  }

  function defaultHeadline(campaign) {
    if (campaign.type === "FREE_SHIPPING_GOAL") return "Free shipping";
    if (campaign.type === "CART_TIMER") return "Your cart is reserved";
    return campaign.name || "Cart offer";
  }

  function renderCampaignIcon(campaign) {
    var design = campaign.design || {};
    var icon = document.createElement("span");
    var image;
    var svg;
    var fallbackIcon =
      campaign.type === "FREE_SHIPPING_GOAL" ? "TRUCK" : "CLOCK";

    if (design.showIcon === false) return null;

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

    svg = getIconSvg(design.icon || fallbackIcon);
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

  function emitImpression(campaign) {
    document.dispatchEvent(
      new CustomEvent("promo-pulse:impression", {
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

  function readStorage(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function safeStorage(storageName) {
    try {
      return window[storageName] || null;
    } catch {
      return null;
    }
  }

  function writeStorage(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      return null;
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

  function parseDate(value) {
    var date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function formatTime(ms, design) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(total / 86400);
    var showDays = !design || design.timerHideZeroDays === false || days > 0;
    var hours = Math.floor((total % 86400) / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    var units;

    if (design && design.timerFormat === "UNITS") {
      units = [];
      if (showDays) {
        units.push(
          formatTimerUnit(days, timerUnitLabel(design, "days"), design),
        );
      }
      units.push(
        formatTimerUnit(
          showDays ? hours : Math.floor(total / 3600),
          timerUnitLabel(design, "hours"),
          design,
        ),
      );
      units.push(
        formatTimerUnit(minutes, timerUnitLabel(design, "minutes"), design),
      );
      if (!design || design.timerShowSeconds !== false) {
        units.push(
          formatTimerUnit(seconds, timerUnitLabel(design, "seconds"), design),
        );
      }
      return units.join(" ");
    }

    if (design && design.timerShowSeconds === false) {
      if (showDays) return [pad(days), pad(hours), pad(minutes)].join(":");
      return pad(hours) + ":" + pad(minutes);
    }

    if (showDays)
      return [pad(days), pad(hours), pad(minutes), pad(seconds)].join(":");
    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  function formatTimerUnit(value, label, design) {
    if (design && design.timerShowLabels === false) return pad(value);
    return pad(value) + " " + label;
  }

  function timerUnitLabel(design, unit) {
    if (unit === "days") return design.timerDaysLabel || "Days";
    if (unit === "hours") return design.timerHoursLabel || "Hrs";
    if (unit === "minutes") return design.timerMinutesLabel || "Mins";
    return design.timerSecondsLabel || "Secs";
  }

  function safeQuerySelector(selector) {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch {
      return null;
    }
  }

  function isPaused(key) {
    return Number(window[key] || 0) > Date.now();
  }

  function pauseRequests(key, ms) {
    window[key] = Math.max(Number(window[key] || 0), Date.now() + ms);
  }

  function safeColor(value, fallback) {
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
        safeColor(design.gradientStartColor, "#252237") +
        ", " +
        safeColor(design.gradientEndColor, "#4c4861") +
        ")"
      );
    }

    return safeColor(design.backgroundColor, "#111827");
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

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function debug(config) {
    if (config && config.debugMode && window.console) {
      window.console.log.apply(
        window.console,
        [""].concat([].slice.call(arguments, 1)),
      );
    }
  }

  function applyStorefrontSettings(config, settings) {
    if (!settings || typeof settings !== "object") return;

    window.PromoPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;
    config.customCartDrawerSelector =
      settings.customCartDrawerSelector || config.customCartDrawerSelector;
    config.currency = config.currency || settings.defaultCurrency || "";
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
