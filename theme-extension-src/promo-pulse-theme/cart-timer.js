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
  var drawerCampaigns = [];
  var drawerCampaignsLoaded = false;
  var proxyPauseMs = 60000;
  var cartPauseMs = 30000;

  window.PromoPulseCartTimer = { init: init };

  init();
  document.addEventListener("shopify:section:load", init);
  document.addEventListener("cart:updated", function () {
    invalidateCachedCartState();
    scheduleCartPageRefresh(true);
    scheduleDrawerRender(true, false);
  });
  document.addEventListener("promo-pulse:cart-changed", function () {
    invalidateCachedCartState();
    scheduleCartPageRefresh(true);
    scheduleDrawerRender(true, false);
  });

  function invalidateCachedCartState() {
    if (window.PromoPulseCartState) {
      window.PromoPulseCartState.updatedAt = 0;
    }
  }

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

    root.__promoPulseCartConfig = config;

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
        root.__promoPulseCartCampaigns = campaigns;
        if (campaigns[0]) {
          renderCartCampaigns(root, campaigns, config, false);
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

  function scheduleCartPageRefresh(force) {
    [].slice
      .call(
        document.querySelectorAll(".pp-cart-timer[data-pp-initialized='true']"),
      )
      .forEach(function (root) {
        if (root.__promoPulseCartRefreshInFlight) {
          root.__promoPulseCartRefreshQueued = true;
          return;
        }

        window.clearTimeout(root.__promoPulseCartRefreshTimer);
        root.__promoPulseCartRefreshTimer = window.setTimeout(
          function () {
            refreshCartPageBlock(root);
          },
          force ? 80 : 300,
        );
      });
  }

  function refreshCartPageBlock(root) {
    var config =
      root.__promoPulseCartConfig || readBlockConfig(root, "CART_PAGE");

    if (!config.shop || root.__promoPulseCartRefreshInFlight) return;

    root.__promoPulseCartRefreshInFlight = true;

    readAjaxCartState()
      .then(function (cartState) {
        config.cartSubtotal =
          cartState.subtotal === null
            ? config.cartSubtotal
            : cartState.subtotal;
        config.currency = cartState.currency || config.currency;
        config.cartToken = cartState.token || config.cartToken;
        applyCartStateSignals(config, cartState);
        root.__promoPulseCartConfig = config;

        if (Array.isArray(root.__promoPulseCartCampaigns)) {
          return root.__promoPulseCartCampaigns;
        }

        return fetchCampaigns(config, root).then(function (campaigns) {
          root.__promoPulseCartCampaigns = campaigns;
          return campaigns;
        });
      })
      .then(function (campaigns) {
        if (campaigns[0]) {
          renderCartCampaigns(root, campaigns, config, false);
        }
      })
      .catch(function (error) {
        updateDebug(root, "Error actualizando CART_PAGE: " + error.message);
        debug(config, "[CP cart refresh]", error);
      })
      .finally(function () {
        root.__promoPulseCartRefreshInFlight = false;
        if (root.__promoPulseCartRefreshQueued) {
          root.__promoPulseCartRefreshQueued = false;
          scheduleCartPageRefresh(true);
        }
      });
  }

  function initDrawerSupport() {
    if (drawerObserverStarted) return;
    if (window.location.pathname.replace(/\/$/, "") === "/cart") return;

    drawerObserverStarted = true;
    scheduleDrawerRender(false, true);
    updateDebug(
      document.getElementById("promo-pulse-app-embed"),
      "Soporte CART_DRAWER activo. Observando apertura/cambios del drawer.",
    );

    new MutationObserver(function (mutations) {
      if (drawerInternalUpdate || !hasExternalDrawerMutation(mutations)) return;
      scheduleDrawerRender(false, false);
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function scheduleDrawerRender(force, shouldFetchCampaigns) {
    if (!drawerObserverStarted) return;
    if (!force && drawerRequestInFlight) return;

    window.clearTimeout(drawerRenderTimer);
    drawerRenderTimer = window.setTimeout(
      function () {
        renderDrawerCampaign(!!force, shouldFetchCampaigns !== false);
      },
      force ? 80 : 300,
    );
  }

  function renderDrawerCampaign(force, shouldFetchCampaigns) {
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
        applyCartStateSignals(config, cartState);
        if (drawerCampaignsLoaded && shouldFetchCampaigns === false) {
          return drawerCampaigns;
        }

        return fetchCampaigns(config, embed).then(function (campaigns) {
          drawerCampaigns = campaigns;
          drawerCampaignsLoaded = true;
          return campaigns;
        });
      })
      .then(function (campaigns) {
        var list = (Array.isArray(campaigns) ? campaigns : []).filter(Boolean);
        var campaign = list[0];
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
        renderCartCampaigns(slot, list, config, true);
        updateDebug(
          embed,
          "CART_DRAWER renderizado en selector compatible. Campañas: " +
            list.length,
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
      device: detectDevice(),
      cartSubtotal: subtotal,
      currency: root.dataset.cartCurrency || detectCurrency(),
      cartToken: root.dataset.cartToken || "",
      cartItemCount: readIntDataset(root.dataset.cartItemCount),
      cartHasDiscount: root.dataset.cartHasDiscount === "true",
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      alignment: root.dataset.alignment || "CENTER",
      compactMode: root.dataset.compact === "true",
      debugMode: root.dataset.debug === "true",
      customCartDrawerSelector: root.dataset.customCartDrawerSelector || "",
      apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
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
      device: detectDevice(),
      cartSubtotal: detectWindowCartSubtotal(),
      currency: detectCurrency(),
      cartToken: "",
      cartItemCount: null,
      cartHasDiscount: false,
      campaignId: "",
      fallbackMode: "AUTO_ELIGIBLE",
      alignment: "CENTER",
      compactMode: false,
      debugMode: root.dataset.debug === "true",
      customCartDrawerSelector: root.dataset.customCartDrawerSelector || "",
      apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };
  }

  function fetchCampaigns(config, debugRoot) {
    var url = buildCampaignUrl(config);
    var campaignId =
      config.fallbackMode === "SPECIFIC_CAMPAIGN" ? config.campaignId : "";

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

    if (window.PromoPulseFetchCampaigns) {
      return window
        .PromoPulseFetchCampaigns(config, config.placement, {
          campaignId: campaignId,
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
            payload.url || url,
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
      device: config.device || detectDevice(),
      placement: config.placement,
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
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
  }

  function getCampaignsEndpoint(apiBaseUrl) {
    var value = String(apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/promo-pulse";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function renderCartCampaigns(root, campaigns, config, isDrawer) {
    var list = (Array.isArray(campaigns) ? campaigns : []).filter(Boolean);
    var cards = [];
    var ticks = [];

    // Fast path: a single FREE_SHIPPING_GOAL campaign that is already rendered
    // is updated in place to avoid resetting/flickering the progress bar on
    // cart refreshes. Mirrors the original single-campaign behavior.
    if (list.length === 1) {
      var only = list[0];
      var existingCard = findExistingCartCard(root, only);

      if (
        existingCard &&
        only.type === "FREE_SHIPPING_GOAL" &&
        !(
          only.design &&
          only.design.mobileEnabled === false &&
          detectDevice() === "mobile"
        )
      ) {
        var ts = calculateTimerState(only, new Date(), config);

        if (!(ts.isExpired && shouldHideExpiredCampaign(only))) {
          applyCartBlockWidth(
            root,
            !isDrawer && (only.design || {}).fullWidth === true,
          );
          updateExistingCartCampaign(existingCard, only, ts, config);
          return;
        }
      }
    }

    list.forEach(function (campaign) {
      var card = buildCartCard(root, campaign, config, isDrawer);
      if (card) {
        cards.push(card);
        ticks.push({ card: card, campaign: campaign });
      }
    });

    if (cards.length === 0) return;

    stopCartTimers(root);
    root.replaceChildren.apply(root, cards);

    ticks.forEach(function (entry) {
      tick(entry.card, entry.campaign, config);
      emitImpression(entry.campaign);
    });
  }

  function buildCartCard(root, campaign, config, isDrawer) {
    var timerState = calculateTimerState(campaign, new Date(), config);
    var texts = campaign.texts || {};
    var design = campaign.design || {};
    var isFullWidth = !isDrawer && design.fullWidth === true;
    var card;

    if (shouldHideUntilTrigger(campaign, config)) {
      updateDebug(
        root,
        "Campana Cart Rescue oculta hasta que se cumpla el disparador del contador (descuento aplicado).",
      );
      return null;
    }
    if (timerState.isExpired && shouldHideExpiredCampaign(campaign)) {
      updateDebug(
        root,
        "Campana recibida, pero el timer expiro y debe ocultarse.",
      );
      return null;
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
      return null;
    }

    if (
      design.dismissBehavior === "HIDE_PERMANENTLY" &&
      isCampaignDismissed(campaign.id)
    ) {
      updateDebug(
        root,
        "Campana cerrada por el visitante; no se vuelve a mostrar.",
      );
      return null;
    }

    if (!window.CountPulseSurface) {
      updateDebug(root, "Surface module no disponible todavia.");
      return null;
    }

    var hasTimer = isTimerEnabled(campaign) && timerState.isActive;
    var detail = buildCartCampaignDetail(campaign, timerState, config);

    var couponNode = null;
    if (
      !timerState.isExpired &&
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.CPcb === "function"
    ) {
      couponNode = window.CPcb(campaign.discount.discountCode, campaign);
    }

    var progress = null;
    if (
      campaign.type === "FREE_SHIPPING_GOAL" &&
      design.showProgressBar !== false
    ) {
      var fs = calculateFreeShippingProgress(campaign, config);
      progress = {
        percentage: fs.progress,
        style: readProgressStyle(campaign),
        unlocked: fs.unlocked,
      };
    }

    var variables = {};
    if (campaign.type === "FREE_SHIPPING_GOAL") {
      var threshold = Number(
        (campaign.freeShipping || {}).thresholdAmount || 0,
      );
      var subtotal = Number(config.cartSubtotal || 0);
      var remaining =
        threshold <= 0 || subtotal >= threshold
          ? 0
          : Math.max(0, threshold - subtotal);
      var amount = money(
        Math.round(remaining * 100) / 100,
        (campaign.freeShipping || {}).currencyCode || config.currency,
      );
      variables = {
        amount: amount,
        remaining: amount,
        remaining_amount: amount,
      };
    }

    var ctaLabel = texts.ctaText;
    var ctaUrl = texts.ctaUrl;
    if (!ctaLabel && campaign.type === "CART_TIMER") {
      ctaLabel = "Checkout";
      ctaUrl = "/checkout";
    }
    var showCta =
      !timerState.isExpired &&
      isButtonEnabled(campaign) &&
      design.showButton !== false &&
      Boolean(ctaLabel);

    card = window.CountPulseSurface.build({
      variant: "block",
      placement: campaign.placement || (isDrawer ? "CART_DRAWER" : "CART_PAGE"),
      design: design,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: config.locale,
      variables: variables,
      headline: texts.headline || defaultHeadline(campaign),
      body: detail,
      timer: {
        isActive: hasTimer,
        isExpired: timerState.isExpired,
        remainingMs: timerState.remainingMs,
      },
      hasTimer: hasTimer,
      couponNode: couponNode,
      cta: showCta ? ctaLabel : "",
      ctaUrl: ctaUrl || "",
      progress: progress,
      dataTestId: isDrawer ? "cart-drawer-widget" : "cart-timer-widget",
      onClose: function () {
        if (design.dismissBehavior === "HIDE_PERMANENTLY") {
          rememberCampaignDismissed(campaign.id);
        }
        removeCartCard(card, design);
      },
    });

    card.dataset.campaignId = campaign.id;
    if (config.compactMode) {
      card.classList.add("counterpulse-preview-promo--compact");
    }
    if (isDrawer) {
      card.classList.add("counterpulse-preview-promo--drawer");
    }
    applyCartBlockWidth(root, isFullWidth);

    return card;
  }

  function findExistingCartCard(root, campaign) {
    if (!root || !root.children) return null;

    return (
      [].slice.call(root.children).find(function (child) {
        return (
          child &&
          child.classList &&
          child.classList.contains("counterpulse-preview-promo") &&
          child.dataset.campaignId === campaign.id
        );
      }) || null
    );
  }

  function updateExistingCartCampaign(card, campaign, timerState, config) {
    var design = campaign.design || {};
    var subheadline = card.querySelector(
      ".counterpulse-preview-message-copy > span",
    );
    var nextMessage = buildCartCampaignDetail(campaign, timerState, config);
    var countdowns = card.querySelectorAll("[data-cp-timer]");

    if (subheadline && subheadline.textContent !== nextMessage) {
      subheadline.textContent = nextMessage;
    }

    updateFreeShippingProgress(card, campaign, config);

    if (countdowns.length && timerState.isActive) {
      Array.prototype.forEach.call(countdowns, function (node) {
        window.CountPulseSurface.updateTimer(
          node,
          timerState.remainingMs,
          design,
        );
      });
    }

    if (timerState.isExpired) {
      if (shouldHideExpiredCampaign(campaign)) {
        removeCartCard(card, design);
      } else {
        card.classList.add("counterpulse-preview-promo--expired");
      }
    }
  }

  function applyCartBlockWidth(root, isFullWidth) {
    var block = root && root.closest ? root.closest(".shopify-block") : null;

    if (root && root.classList) {
      root.classList.toggle("pp-cart-timer--full-width", isFullWidth);
    }

    if (!block) return;

    if (isFullWidth) {
      // Cart placements fill their container, not the viewport. Only
      // TOP_BAR / BOTTOM_BAR break out to 100vw.
      block.dataset.ppCartTimerFullWidth = "true";
      block.style.setProperty("width", "100%");
      block.style.setProperty("max-width", "100%");
      block.style.removeProperty("margin-left");
      block.style.removeProperty("margin-right");
      return;
    }

    if (block.dataset.ppCartTimerFullWidth !== "true") return;

    delete block.dataset.ppCartTimerFullWidth;
    block.style.removeProperty("width");
    block.style.removeProperty("max-width");
    block.style.removeProperty("margin-left");
    block.style.removeProperty("margin-right");
  }

  function stopCartTimers(root) {
    if (!root || !root.querySelectorAll) return;

    [].slice
      .call(root.querySelectorAll(".pp-cart-card, .counterpulse-preview-promo"))
      .forEach(function (card) {
        if (card.__promoPulseTimerInterval) {
          window.clearInterval(card.__promoPulseTimerInterval);
          card.__promoPulseTimerInterval = null;
        }
      });
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
      "#promo-pulse-app-embed, .pp-debug, #promo-pulse-cart-drawer-slot, .pp-cart-drawer-slot, .pp-container, .pp-cart-card, .counterpulse-preview-promo",
    );
  }

  function updateFreeShippingProgress(card, campaign, config) {
    var progress = card.querySelector(".counterpulse-preview-progress");
    var fill = progress && progress.querySelector("span > span");
    var state;

    if (!progress) return;

    state = calculateFreeShippingProgress(campaign, config);
    progress.classList.toggle(
      "counterpulse-preview-progress--unlocked",
      state.unlocked,
    );
    progress.style.setProperty("--cp-progress", state.progress + "%");
    if (fill) {
      fill.style.width = Math.max(0, state.progress) + "%";
    }
  }

  function calculateFreeShippingProgress(campaign, config) {
    var threshold = Number((campaign.freeShipping || {}).thresholdAmount || 0);
    var subtotal = Number(config.cartSubtotal || 0);
    var unlocked = threshold <= 0 || subtotal >= threshold;
    var progress =
      threshold > 0
        ? Math.min(100, Math.max(0, (subtotal / threshold) * 100))
        : 100;

    return {
      label: buildFreeShippingText(campaign, config) || "",
      progress: progress,
      unlocked: unlocked,
    };
  }

  function buildCartCampaignDetail(campaign, timerState, config) {
    var texts = campaign.texts || {};
    var detail = texts.subheadline || "";

    if (campaign.type === "FREE_SHIPPING_GOAL") {
      detail = buildFreeShippingText(campaign, config) || detail;
    }

    if (timerState.isExpired && texts.expiredText) {
      detail = texts.expiredText;
    }

    return detail;
  }

  function readProgressStyle(campaign) {
    var style = String(
      (campaign.freeShipping || {}).progressStyle || "BAR",
    ).toUpperCase();

    return style === "COMPACT" || style === "CIRCULAR" ? style : "BAR";
  }

  function dismissStorageKey(campaignId) {
    return "promo_pulse_dismissed_" + campaignId;
  }

  function isCampaignDismissed(campaignId) {
    if (!campaignId) return false;

    try {
      return window.localStorage.getItem(dismissStorageKey(campaignId)) === "1";
    } catch (error) {
      return false;
    }
  }

  function rememberCampaignDismissed(campaignId) {
    if (!campaignId) return;

    try {
      window.localStorage.setItem(dismissStorageKey(campaignId), "1");
    } catch (error) {
      /* storage blocked: dismissal cannot persist */
    }
  }

  function removeCartCard(card, design) {
    var duration = clamp((design || {}).animationDurationMs, 0, 1500, 220);

    if (
      !(design || {}).exitAnimation ||
      (design || {}).exitAnimation === "NONE" ||
      duration === 0
    ) {
      stopSingleCartTimer(card);
      card.remove();
      return;
    }

    card.classList.add("pp-bar--closing");
    window.setTimeout(function () {
      stopSingleCartTimer(card);
      card.remove();
    }, duration);
  }

  function stopSingleCartTimer(card) {
    if (card && card.__promoPulseTimerInterval) {
      window.clearInterval(card.__promoPulseTimerInterval);
      card.__promoPulseTimerInterval = null;
    }
  }

  function getExpiredBehavior(campaign) {
    return (campaign.timer || {}).expiredBehavior || "UNPUBLISH_TIMER";
  }

  function shouldHideExpiredCampaign(campaign) {
    var behavior = getExpiredBehavior(campaign);
    return behavior === "UNPUBLISH_TIMER" || behavior === "HIDE_TIMER";
  }

  function tick(card, campaign, config) {
    if (!card.querySelector("[data-cp-timer]")) return;

    card.__promoPulseTimerInterval = window.setInterval(function () {
      var state = calculateTimerState(campaign, new Date(), config);
      var countdowns = card.querySelectorAll("[data-cp-timer]");
      var countdown = countdowns[0];
      var subheadline = card.querySelector(
        ".counterpulse-preview-message-copy > span",
      );
      var expiredText = (campaign.texts || {}).expiredText || "";
      var expiredBehavior = getExpiredBehavior(campaign);

      if (!countdown) return;
      if (state.isExpired) {
        Array.prototype.forEach.call(countdowns, function (node) {
          node.remove();
        });
        card.classList.add("counterpulse-preview-promo--expired");
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

      window.CountPulseSurface.updateTimer(
        countdown,
        state.remainingMs,
        campaign.design || {},
      );
    }, 1000);
  }

  function calculateTimerState(campaign, now, config) {
    var timer = campaign.timer || {};

    if (!isTimerEnabled(campaign)) {
      return buildTimerState(now, null);
    }

    if (timer.mode === "EVERGREEN_SESSION" || campaign.type === "CART_TIMER") {
      return calculateCartReserveTimer(campaign, now, config);
    }

    return buildTimerState(now, parseDate(campaign.endsAt));
  }

  function calculateCartReserveTimer(campaign, now, config) {
    var timer = campaign.timer || {};
    var timerStart = cartRescueTimerStart(campaign);
    var duration = Number(timer.durationMinutes);

    // DISCOUNT_APPLIED gates the countdown until the cart carries a discount.
    if (timerStart === "DISCOUNT_APPLIED" && !config.cartHasDiscount) {
      return buildTimerState(now, null);
    }

    // FIRST_ITEM keeps a single fixed deadline for the life of the cart, so it
    // always persists in localStorage regardless of the session reset behavior.
    var useLocalStorage =
      timerStart === "FIRST_ITEM" || timer.resetBehavior !== "ON_SESSION_END";
    var storage = safeStorage(
      useLocalStorage ? "localStorage" : "sessionStorage",
    );
    var token = config.cartToken || "session";
    var key = "promo_pulse_cart_deadline_" + campaign.id + "_" + token;
    var stored = readStorage(storage, key);
    var startedAt = parseDate(stored && stored.startedAt);
    var endsAt = parseDate(stored && stored.endsAt);
    var fingerprint = cartFingerprint(config);

    // LATEST_ITEM restarts the countdown whenever the cart contents change.
    var fingerprintChanged =
      timerStart === "LATEST_ITEM" &&
      stored &&
      typeof stored.fingerprint === "string" &&
      stored.fingerprint !== fingerprint;

    if (startedAt && endsAt && !fingerprintChanged) {
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
      fingerprint: fingerprint,
    });

    return buildTimerState(now, endsAt);
  }

  function cartRescueTimerStart(campaign) {
    return (campaign.cartRescue || {}).timerStart || "CART_VIEWED";
  }

  function cartFingerprint(config) {
    var count =
      config.cartItemCount === null || config.cartItemCount === undefined
        ? ""
        : String(config.cartItemCount);
    var subtotal =
      config.cartSubtotal === null || config.cartSubtotal === undefined
        ? ""
        : String(config.cartSubtotal);

    return count + ":" + subtotal;
  }

  function shouldHideUntilTrigger(campaign, config) {
    if (!isTimerEnabled(campaign)) return false;

    var rescue = campaign.cartRescue || {};

    if (rescue.timerStart !== "DISCOUNT_APPLIED") return false;
    if (rescue.armBeforeStart === true) return false;

    return !config.cartHasDiscount;
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
    var recentCartState = readRecentCartState();

    if (recentCartState) return Promise.resolve(recentCartState);

    if (isPaused("PromoPulseCartPausedUntil")) {
      return Promise.resolve({
        subtotal: detectWindowCartSubtotal(),
        currency: window.PromoPulseCartCurrency || "",
        token: "",
        hasDiscount: null,
        itemCount: null,
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
        updateCartState(cart);

        return {
          subtotal:
            typeof cart.total_price === "number"
              ? cart.total_price / 100
              : detectWindowCartSubtotal(),
          currency: cart.currency || "",
          token: cart.token || "",
          hasDiscount: cartHasAppliedDiscount(cart),
          itemCount:
            typeof cart.item_count === "number" ? cart.item_count : null,
        };
      })
      .catch(function () {
        return {
          subtotal: detectWindowCartSubtotal(),
          currency: window.PromoPulseCartCurrency || "",
          token: "",
          hasDiscount: null,
          itemCount: null,
        };
      });
  }

  function cartHasAppliedDiscount(cart) {
    if (!cart || typeof cart !== "object") return false;

    var discountCodes = Array.isArray(cart.discount_codes)
      ? cart.discount_codes
      : [];
    var cartLevel = Array.isArray(cart.cart_level_discount_applications)
      ? cart.cart_level_discount_applications
      : [];

    return (
      Number(cart.total_discount || 0) > 0 ||
      discountCodes.some(function (entry) {
        return entry && entry.applicable !== false && entry.code;
      }) ||
      cartLevel.length > 0
    );
  }

  function readIntDataset(value) {
    var parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function applyCartStateSignals(config, cartState) {
    if (cartState.hasDiscount !== null && cartState.hasDiscount !== undefined) {
      config.cartHasDiscount = cartState.hasDiscount;
    }
    if (cartState.itemCount !== null && cartState.itemCount !== undefined) {
      config.cartItemCount = cartState.itemCount;
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

  function buildFreeShippingText(campaign, config) {
    var texts = campaign.texts || {};
    var settings = campaign.freeShipping || {};
    var subtotal = config ? Number(config.cartSubtotal || 0) : 0;
    var threshold = Number(settings.thresholdAmount || 0);
    var remaining = Math.max(0, threshold - subtotal);
    var amount = money(remaining, config && config.currency);
    var progressText = "You're {{remaining_amount}} away from free shipping";
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
    if (campaign.type === "CART_TIMER") return "Your cart is ready";
    return campaign.name || "Cart offer";
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

  function isTimerEnabled(campaign) {
    return !(campaign.cartRescue && campaign.cartRescue.showTimer === false);
  }

  function isButtonEnabled(campaign) {
    return !(campaign.cartRescue && campaign.cartRescue.showButton === false);
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
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

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, Math.round(number)))
      : fallback;
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
