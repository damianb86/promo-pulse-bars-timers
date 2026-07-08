(function () {
  "use strict";

  // Expose the canonical countdown renderer so dedicated blocks (e.g. delivery
  // cutoff) render the timer with the exact same Timer Type styling instead of
  // reimplementing it. Defined before the embed check so it is available even
  // when this file loads for its globals only.
  window.PromoPulseRenderCountdown =
    window.PromoPulseRenderCountdown ||
    function (remainingMs, design, compact) {
      return renderCountdown(
        { remainingMs: remainingMs, isActive: true },
        design || {},
        compact === true,
      );
    };
  window.PromoPulseUpdateCountdown =
    window.PromoPulseUpdateCountdown ||
    function (element, remainingMs, design, compact) {
      if (element) {
        updateCountdownElement(
          element,
          remainingMs,
          design || {},
          compact === true,
        );
      }
    };
  // Compute a timer state ({ isActive, isExpired, remainingMs }) for a campaign
  // (with .timer/.timezone) so dedicated blocks can render the configured timer
  // with the same logic as the app embed.
  window.PromoPulseComputeTimerState =
    window.PromoPulseComputeTimerState ||
    function (campaign) {
      return calculateTimerState(campaign || {}, new Date());
    };

  var root = document.getElementById("promo-pulse-app-embed");
  if (!root) return;

  var config = {
    shop: detectShop(root),
    path: window.location.pathname,
    locale: detectLocale(root),
    country: detectCountry(root),
    market: detectMarket(root),
    currency: detectCurrency(root),
    productId: root.dataset.productId || "",
    productTags: splitList(root.dataset.productTags),
    collectionIds: splitList(root.dataset.collectionIds),
    device: detectDevice(),
    utmSource:
      new URLSearchParams(window.location.search).get("utm_source") || "",
    debugMode: root.dataset.debug === "true",
    apiPath: getCampaignsEndpoint(root.dataset.apiBaseUrl),
  };
  var campaignCache = {};
  var pendingFetches = {};
  var renderedCampaigns = {};
  var currentRenderScope = "";
  var currentRenderFingerprints = {};
  var cacheTtlMs = 30000;
  var globalPlacements = "TOP_BAR,BOTTOM_BAR,CUSTOM_SELECTOR";

  if (!config.shop) {
    updateDebug(root, "Embed detenido: falta el shop domain.");
    return;
  }

  updateDebug(
    root,
    "Embed JS cargado. Consultando placements globales; cart drawer, free shipping y delivery cutoff los manejan assets dedicados.",
  );

  fetchCampaigns(globalPlacements, "", function (campaigns) {
    renderCampaignsForScope(globalPlacements, "", campaigns);
  })
    .then(function (campaigns) {
      updateDebug(
        root,
        "API global OK: " +
          campaigns.length +
          " campana(s) recibidas para placements globales.",
      );
      renderCampaignsForScope(globalPlacements, "", campaigns);
    })
    .catch(function (error) {
      updateDebug(root, "Error global del embed: " + error.message);
      debug(error);
    });

  renderInlineSnippets();

  function fetchCampaigns(placement, campaignId, onRevalidate) {
    var url = buildCampaignUrl(placement, campaignId);
    var cached = campaignCache[url];
    var now = Date.now();

    updateDebug(root, "Consultando " + placement + ".", url);

    if (window.PromoPulseFetchCampaigns) {
      return window
        .PromoPulseFetchCampaigns(config, placement, {
          campaignId: campaignId || "",
          onRevalidate: function (payload) {
            if (typeof onRevalidate === "function") {
              onRevalidate(normalizeCampaignPayload(payload, placement, url));
            }
          },
        })
        .then(function (payload) {
          var campaigns = normalizeCampaignPayload(payload, placement, url);
          return campaigns;
        })
        .catch(function (error) {
          updateDebug(
            root,
            "Error consultando " + placement + ": " + error.message,
            url,
          );
          debug(placement, error);
          return [];
        });
    }

    if (cached && cached.expiresAt > now) {
      updateDebug(
        root,
        "Usando cache local para " +
          placement +
          ": " +
          cached.campaigns.length +
          " campana(s).",
        url,
      );
      return Promise.resolve(cached.campaigns);
    }

    if (pendingFetches[url]) {
      return pendingFetches[url];
    }

    pendingFetches[url] = window
      .fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(response.status);
        }

        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(payload.settings);
        var campaigns = Array.isArray(payload.campaigns)
          ? expandCampaignPlacements(payload.campaigns.map(applyExperiment))
          : [];
        campaignCache[url] = {
          campaigns: campaigns,
          expiresAt: Date.now() + cacheTtlMs,
        };
        updateDebug(
          root,
          "API OK para " + placement + ": " + campaigns.length + " campana(s).",
          url,
        );
        return campaigns;
      })
      .catch(function (error) {
        updateDebug(
          root,
          "Error consultando " + placement + ": " + error.message,
          url,
        );
        debug(placement, error);
        return [];
      })
      .finally(function () {
        delete pendingFetches[url];
      });

    return pendingFetches[url];
  }

  function normalizeCampaignPayload(payload, placement, url) {
    applyStorefrontSettings(payload.settings);
    var campaigns = Array.isArray(payload.campaigns)
      ? expandCampaignPlacements(payload.campaigns.map(applyExperiment))
      : [];

    updateDebug(
      root,
      "API OK para " + placement + ": " + campaigns.length + " campana(s).",
      payload.url || url,
    );

    return campaigns;
  }

  function buildCampaignUrl(placement, campaignId) {
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
    if (config.productId) params.set("productId", config.productId);
    if (config.productTags.length) {
      params.set("productTags", config.productTags.join(","));
    }
    if (config.collectionIds.length) {
      params.set("collectionIds", config.collectionIds.join(","));
    }
    if (config.utmSource) params.set("utmSource", config.utmSource);
    if (campaignId) params.set("campaignId", campaignId);
    appendBehaviorTargetingParams(params);

    return config.apiPath + "?" + params.toString();
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
    var value = (window.PromoPulseApiBaseUrl || apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/promo-pulse";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function renderInlineSnippets() {
    [].slice
      .call(document.querySelectorAll("[data-promo-pulse-campaign-id]"))
      .forEach(function (slot, index) {
        var campaignId = slot.dataset.promoPulseCampaignId || "";
        var placement = slot.dataset.promoPulsePlacement || "";

        if (
          placement !== "CUSTOM_SELECTOR" ||
          !campaignId ||
          slot.dataset.promoPulseRenderStarted === "true"
        ) {
          return;
        }

        slot.dataset.promoPulseRenderStarted = "true";
        slot.dataset.promoPulseSlotIndex = String(index);

        fetchCampaigns("CUSTOM_SELECTOR", campaignId, function (campaigns) {
          renderCampaignsForScope(
            "CUSTOM_SELECTOR",
            campaignId,
            campaigns,
            slot,
          );
        }).then(function (campaigns) {
          renderCampaignsForScope(
            "CUSTOM_SELECTOR",
            campaignId,
            campaigns,
            slot,
          );
        });
      });
  }

  function renderCampaignsForScope(
    placement,
    campaignId,
    campaigns,
    targetContainer,
  ) {
    var scopeKey = getRenderScopeKey(placement, campaignId, targetContainer);
    var activeKeys = {};
    var nextFingerprints = {};
    var previousScope = currentRenderScope;
    var previousFingerprints = currentRenderFingerprints;

    campaigns.forEach(function (campaign) {
      var renderKey = getRenderKey(campaign, targetContainer);
      var existing;
      var fingerprint;

      if (!renderKey) return;

      fingerprint = getCampaignFingerprint(campaign);
      activeKeys[renderKey] = true;
      nextFingerprints[renderKey] = fingerprint;
      existing = renderedCampaigns[renderKey];

      if (existing && existing.fingerprint !== fingerprint) {
        removeRenderedCampaign(renderKey);
      }
    });

    currentRenderScope = scopeKey;
    currentRenderFingerprints = nextFingerprints;
    campaigns.forEach(function (campaign) {
      renderCampaign(campaign, targetContainer);
    });
    currentRenderScope = previousScope;
    currentRenderFingerprints = previousFingerprints;

    reconcileRenderedCampaigns(scopeKey, activeKeys);
  }

  function getRenderScopeKey(placement, campaignId, targetContainer) {
    if (targetContainer) {
      return (
        "snippet:" +
        targetContainer.dataset.promoPulseSlotIndex +
        ":" +
        (campaignId || "")
      );
    }

    return placement + ":" + (campaignId || "");
  }

  function getRenderKey(campaign, targetContainer) {
    var base;

    if (!campaign || !campaign.id || !campaign.placement) return "";

    base = targetContainer
      ? "snippet:" + targetContainer.dataset.promoPulseSlotIndex
      : campaign.placement;

    return (
      base + (campaign.type === "PRODUCT_BADGE" ? ":badge:" : ":") + campaign.id
    );
  }

  function getCampaignFingerprint(campaign) {
    try {
      return JSON.stringify(campaign);
    } catch {
      return String(Date.now());
    }
  }

  function reconcileRenderedCampaigns(scopeKey, activeKeys) {
    Object.keys(renderedCampaigns).forEach(function (renderKey) {
      var rendered = renderedCampaigns[renderKey];

      if (rendered.scopeKey === scopeKey && !activeKeys[renderKey]) {
        removeRenderedCampaign(renderKey);
      }
    });
  }

  function removeRenderedCampaign(renderKey) {
    var rendered = renderedCampaigns[renderKey];
    var element = rendered && rendered.element;
    var parent = element && element.parentNode;

    if (element && parent) {
      parent.removeChild(element);
      syncStickyContainer(parent);
    }

    delete renderedCampaigns[renderKey];
  }

  function renderCampaign(campaign, targetContainer) {
    if (
      !campaign ||
      !campaign.placement ||
      campaign.type === "FREE_SHIPPING_GOAL" ||
      campaign.type === "DELIVERY_CUTOFF"
    )
      return;

    var design = campaign.design || {};
    var timerState = calculateTimerState(campaign, new Date());
    if (design.mobileEnabled === false && config.device === "mobile") return;
    if (timerState.isExpired && shouldHideExpiredCampaign(campaign)) return;
    if (
      design.dismissBehavior === "HIDE_PERMANENTLY" &&
      isCampaignDismissed(campaign.id)
    )
      return;

    if (campaign.type === "PRODUCT_BADGE") {
      renderProductBadgeCampaign(campaign, targetContainer, timerState);
      return;
    }

    var renderKey = getRenderKey(campaign, targetContainer);

    if (renderedCampaigns[renderKey]) return;

    var container = targetContainer
      ? getSnippetContainer(targetContainer, campaign.placementStyle)
      : getPlacementContainer(
          campaign.placement,
          campaign.placementSelector,
          campaign.placementStyle,
        );

    if (!container) return;
    if (!window.CountPulseSurface) return;

    var texts = campaign.texts || {};
    var detail = texts.subheadline || "";
    if (timerState.isExpired && texts.expiredText) {
      detail = texts.expiredText;
    }

    var couponNode = null;
    if (
      !timerState.isExpired &&
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.PromoPulseCouponButton === "function"
    ) {
      couponNode = window.PromoPulseCouponButton(
        campaign.discount.discountCode,
        campaign,
      );
    }

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
      headline: texts.headline || "Promo Pulse promotion",
      body: detail,
      timer: {
        isActive: timerState.isActive,
        isExpired: timerState.isExpired,
        remainingMs: timerState.remainingMs,
      },
      hasTimer: timerState.isActive,
      couponNode: couponNode,
      cta:
        !timerState.isExpired && design.showButton !== false
          ? texts.ctaText || ""
          : "",
      ctaUrl: texts.ctaUrl || "",
      dataTestId: "promo-bar",
      onClose: function () {
        if (design.dismissBehavior === "HIDE_PERMANENTLY") {
          rememberCampaignDismissed(campaign.id);
        }
        removeBar(bar, design);
        delete renderedCampaigns[renderKey];
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

    container.appendChild(bar);
    syncStickyContainer(container);
    renderedCampaigns[renderKey] = {
      element: bar,
      scopeKey: currentRenderScope || renderKey,
      fingerprint: currentRenderFingerprints[renderKey] || "",
    };
    startCountdown(bar, campaign);
    emitImpression(campaign);
  }

  function renderProductBadgeCampaign(campaign, targetContainer, timerState) {
    var design = campaign.design || {};
    var badgeSettings = campaign.badge || {};
    var renderKey = getRenderKey(campaign, targetContainer);
    var container = targetContainer
      ? getSnippetContainer(targetContainer, campaign.placementStyle)
      : getPlacementContainer(
          campaign.placement,
          campaign.placementSelector,
          campaign.placementStyle,
        );
    var rootEl;
    var badgeEl;
    var badgeText;
    var badgeHref;
    if (!container || renderedCampaigns[renderKey]) return;
    if (!window.CountPulseSurface) return;

    rootEl = document.createElement("div");
    rootEl.className = "pp-root pp-product-badge pp-product-badge--surface";
    rootEl.dataset.campaignId = campaign.id;
    rootEl.dataset.testid = "promo-badge-root";

    badgeText = getBadgeText(campaign, badgeSettings);
    badgeHref = getBadgeHref(campaign);

    badgeEl = window.CountPulseSurface.build({
      variant: "badge",
      placement: campaign.placement,
      design: design,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: config.locale,
      headline: badgeText,
      hasTimer: timerState.isActive,
      timer: {
        isActive: timerState.isActive,
        isExpired: timerState.isExpired,
        remainingMs: timerState.remainingMs,
      },
      badge: {
        text: badgeText,
        shape: badgeSettings.badgeShape,
        position: badgeSettings.badgePosition,
      },
      dataTestId: "promo-badge",
    });
    badgeEl.dataset.campaignId = campaign.id;
    badgeEl.setAttribute(
      "aria-label",
      (badgeText || "Promo Pulse badge").trim(),
    );

    if (badgeHref) {
      var link = document.createElement("a");
      link.href = badgeHref;
      link.className = "counterpulse-preview-badge-link";
      link.addEventListener("click", function () {
        emitClick(campaign);
      });
      while (badgeEl.firstChild) link.appendChild(badgeEl.firstChild);
      badgeEl.appendChild(link);
    } else {
      badgeEl.setAttribute("role", "note");
    }

    rootEl.appendChild(badgeEl);
    container.appendChild(rootEl);
    renderedCampaigns[renderKey] = {
      element: rootEl,
      scopeKey: currentRenderScope || renderKey,
      fingerprint: currentRenderFingerprints[renderKey] || "",
    };
    startCountdown(rootEl, campaign);
    emitImpression(campaign);
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  // The API sends each campaign once, listing all its placements in a
  // `placements` array. Expand it back into one render unit per placement so the
  // per-placement renderer keeps working unchanged.
  function expandCampaignPlacements(campaigns) {
    var expanded = [];

    campaigns.forEach(function (campaign) {
      if (!campaign) return;

      var placements =
        campaign.placements &&
        typeof campaign.placements.length === "number" &&
        campaign.placements.length > 0
          ? campaign.placements
          : null;

      if (!placements) {
        expanded.push(campaign);
        return;
      }

      placements.forEach(function (descriptor) {
        var copy = {};
        for (var key in campaign) {
          if (Object.prototype.hasOwnProperty.call(campaign, key)) {
            copy[key] = campaign[key];
          }
        }
        copy.placement =
          descriptor.placement ||
          descriptor.placementType ||
          campaign.placement;
        copy.placementSelector = descriptor.placementSelector || "";
        copy.placementStyle = descriptor.placementStyle || "";
        delete copy.placements;
        expanded.push(copy);
      });
    });

    return expanded;
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

  function getPlacementContainer(placement, selector, customStyle) {
    var target;
    var customContainer;
    var id = placement === "BOTTOM_BAR" ? "pp-bottom-bars" : "pp-top-bars";
    var existingContainer = document.getElementById(id);
    var container;
    var configuredTarget;

    if (placement === "CUSTOM_SELECTOR") {
      target = querySelectorList(
        selector || getConfiguredSelector("CUSTOM_SELECTOR"),
      );

      if (!target) return null;

      customContainer = document.createElement("div");
      customContainer.className = "pp-container pp-container--custom-selector";
      applyCustomPlacementStyle(customContainer, customStyle);
      target.appendChild(customContainer);

      return customContainer;
    }

    if (existingContainer) return existingContainer;

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

  function getSnippetContainer(target, customStyle) {
    var container = document.createElement("div");

    container.className =
      "pp-container pp-container--custom-selector pp-container--snippet";
    applyCustomPlacementStyle(container, customStyle);
    target.appendChild(container);

    return container;
  }

  function applyCustomPlacementStyle(element, customStyle) {
    var styleText = typeof customStyle === "string" ? customStyle.trim() : "";

    if (!styleText) return;

    element.setAttribute("style", styleText);
  }

  function getConfiguredSelector(placement) {
    var settings = window.PromoPulseSettings || {};
    var keys = {
      TOP_BAR: "customTopBarSelector",
      BOTTOM_BAR: "customBottomBarSelector",
      PRODUCT_PAGE: "customProductPageSelector",
      PRODUCT_PAGE_BADGE: "customProductPageBadgeSelector",
      COLLECTION_CARD: "customCollectionCardSelector",
      CART_PAGE: "customCartPageSelector",
      CART_DRAWER: "customCartDrawerSelector",
      THANK_YOU_PAGE: "customThankYouPageSelector",
      ORDER_STATUS_PAGE: "customOrderStatusPageSelector",
      CUSTOM_SELECTOR: "customHtmlSlotSelector",
    };
    var key = keys[placement];
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

    if (!selector || typeof selector !== "string") {
      return null;
    }

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
        updateDebug(root, "Selector invalido: " + currentSelector);
        debug(currentSelector, error);
      }
    }

    return null;
  }

  function renderCountdown(timerState, design, compact) {
    var timerStyle = safeTimerStyle(design.timerStyle);
    var timerFormat = safeTimerFormat(design.timerFormat);
    var countdown = document.createElement(
      compact && timerStyle === "PLAIN" ? "span" : "div",
    );
    var tickClass =
      design.timerTickAnimation && design.timerTickAnimation !== "NONE"
        ? " pp-countdown--tick-" +
          String(design.timerTickAnimation).toLowerCase()
        : "";

    countdown.className =
      "pp-countdown pp-countdown--" +
      timerStyle.toLowerCase() +
      " pp-countdown--" +
      timerFormat.toLowerCase() +
      (design.timerNumberLayout === "STACKED" ? " pp-countdown--stacked" : "") +
      (compact ? " pp-countdown--compact" : "") +
      tickClass;
    countdown.dataset.testid = "promo-timer";
    updateCountdownElement(countdown, timerState.remainingMs, design, compact);
    countdown.setAttribute("aria-live", "polite");
    countdown.setAttribute("aria-label", "Time remaining");

    return countdown;
  }

  function updateCountdownElement(countdown, ms, design, compact) {
    var timerStyle = safeTimerStyle(design.timerStyle);
    var timerFormat = safeTimerFormat(design.timerFormat);
    var parts = buildTimerParts(ms, design);
    var visibleParts =
      design.timerShowSeconds === false
        ? parts.filter(function (part) {
            return part.key !== "seconds";
          })
        : parts;
    var nextText;

    if (!visibleParts.length) {
      visibleParts = [parts[parts.length - 1]];
    }

    if (timerFormat === "COLON") {
      nextText = formatTimerPartsAsColon(visibleParts);
      if (countdown.dataset.value === nextText) return;

      countdown.dataset.value = nextText;
      countdown.textContent = nextText;
      return;
    }

    nextText = visibleParts
      .map(function (part) {
        return design.timerShowLabels === false
          ? part.value
          : part.value + " " + part.shortLabel;
      })
      .join(" ");

    if (timerStyle === "PLAIN" && compact) {
      if (countdown.dataset.value === nextText) return;

      countdown.dataset.value = nextText;
      countdown.textContent = nextText;
      return;
    }

    if (countdown.dataset.value === nextText) return;

    var previousUnitValues = readCountdownUnitValues(countdown);
    var tickAnimation = getCountdownTickAnimation(countdown);
    countdown.dataset.value = nextText;
    countdown.dataset.unitValues = JSON.stringify(
      visibleParts.reduce(function (values, part) {
        values[part.key] = part.value;
        return values;
      }, {}),
    );
    countdown.replaceChildren();
    visibleParts.forEach(function (part) {
      var unit = document.createElement("span");
      var value = document.createElement("strong");
      var label = document.createElement("small");

      unit.className = "pp-countdown-unit";
      value.textContent = part.value;
      if (
        tickAnimation &&
        previousUnitValues[part.key] &&
        previousUnitValues[part.key] !== part.value
      ) {
        value.classList.add(
          "pp-countdown-tick-value",
          "pp-countdown-tick-value--" + tickAnimation,
        );
      }
      unit.appendChild(value);

      if (design.timerShowLabels !== false) {
        label.textContent = part.label;
        unit.appendChild(label);
      }

      countdown.appendChild(unit);
    });
  }

  function emitClick(campaign) {
    document.dispatchEvent(
      new CustomEvent("promo-pulse:click", {
        detail: {
          campaignId: campaign.id,
          experimentId: campaign.experimentId || null,
          variantId: campaign.variantId || null,
          placement: campaign.placement,
        },
      }),
    );
  }

  function getBadgeText(campaign, badgeSettings) {
    var texts = campaign.texts || {};

    return (
      badgeSettings.badgeText ||
      texts.badgeText ||
      texts.headline ||
      campaign.name ||
      "Limited offer"
    );
  }

  function getBadgeHref(campaign) {
    var href = ((campaign.texts || {}).ctaUrl || "").trim();

    return isSafeUrl(href) ? href : "";
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

    stickyBars = container.querySelectorAll(
      ".counterpulse-preview-promo--sticky",
    );
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

  function getCountdownTickAnimation(countdown) {
    var match = String(countdown.className || "").match(
      /\bpp-countdown--tick-(fade|flip|pulse)\b/,
    );

    return match ? match[1] : "";
  }

  function readCountdownUnitValues(countdown) {
    try {
      return JSON.parse(countdown.dataset.unitValues || "{}");
    } catch (error) {
      return {};
    }
  }

  function getExpiredBehavior(campaign) {
    return (campaign.timer || {}).expiredBehavior || "UNPUBLISH_TIMER";
  }

  function shouldHideExpiredCampaign(campaign) {
    var behavior = getExpiredBehavior(campaign);
    return behavior === "UNPUBLISH_TIMER" || behavior === "HIDE_TIMER";
  }

  function startCountdown(bar, campaign) {
    if (!bar.querySelector("[data-cp-timer]")) return;

    window.setInterval(function () {
      var timerState = calculateTimerState(campaign, new Date());
      var countdowns = bar.querySelectorAll("[data-cp-timer]");
      var countdown = countdowns[0];
      var subheadline = bar.querySelector(
        ".counterpulse-preview-message-copy > span",
      );
      var expiredText = (campaign.texts || {}).expiredText || "";
      var expiredBehavior = getExpiredBehavior(campaign);

      if (!countdown) return;

      if (timerState.isExpired) {
        Array.prototype.forEach.call(countdowns, function (node) {
          node.remove();
        });
        bar.classList.add("counterpulse-preview-promo--expired");

        if (expiredBehavior === "SHOW_CUSTOM_TITLE" && expiredText) {
          if (!subheadline) {
            subheadline = document.createElement("span");
            bar
              .querySelector(".counterpulse-preview-message-copy")
              ?.appendChild(subheadline);
          }
          subheadline.textContent = expiredText;
        } else if (
          expiredBehavior === "HIDE_TIMER" ||
          expiredBehavior === "UNPUBLISH_TIMER"
        ) {
          removeBar(bar, campaign.design || {});
        }

        return;
      }

      Array.prototype.forEach.call(countdowns, function (node) {
        window.CountPulseSurface.updateTimer(
          node,
          timerState.remainingMs,
          campaign.design || {},
        );
      });
    }, 1000);
  }

  function calculateTimerState(campaign, now) {
    var timer = campaign.timer || {};
    var mode = timer.mode || "FIXED_DATE";

    if (mode === "EVERGREEN_SESSION") {
      return calculateEvergreenTimer(campaign, now);
    }

    if (mode === "RECURRING_DAILY") {
      return calculateRecurringDailyTimer(timer, now, campaign.timezone);
    }

    if (mode === "RECURRING_WEEKLY") {
      return calculateRecurringWeeklyTimer(timer, now, campaign.timezone);
    }

    return buildTimerState(now, parseDate(campaign.endsAt));
  }

  function calculateEvergreenTimer(campaign, now) {
    var timer = campaign.timer || {};
    var durationMinutes = Number(timer.durationMinutes);
    var storage = getEvergreenStorage(timer.resetBehavior);
    var key = "promo_pulse_deadline_" + campaign.id;
    var stored = readStorage(storage, key);
    var startedAt = parseDate(stored && stored.startedAt);
    var endsAt = parseDate(stored && stored.endsAt);

    if (
      startedAt &&
      endsAt &&
      shouldReuseStorage(
        startedAt,
        now,
        campaign.timezone,
        timer.resetBehavior,
      ) &&
      !(
        timer.expiredBehavior === "REPEAT_COUNTDOWN" &&
        endsAt.getTime() <= now.getTime()
      )
    ) {
      return buildTimerState(now, endsAt);
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return emptyTimerState();
    }

    startedAt = now;
    endsAt = new Date(now.getTime() + Math.round(durationMinutes) * 60000);
    writeStorage(storage, key, {
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    return buildTimerState(now, endsAt);
  }

  function calculateRecurringDailyTimer(timer, now, timezone) {
    var cutoff = getCutoff(timer);
    var parts;
    var endsAt;

    if (!cutoff) return emptyTimerState();

    parts = getZonedParts(now, timezone);
    endsAt = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      cutoff.hour,
      cutoff.minute,
      timezone,
    );

    return buildTimerState(now, endsAt);
  }

  function calculateRecurringWeeklyTimer(timer, now, timezone) {
    var rules = getWeeklyRules(timer);
    var parts = getZonedParts(now, timezone);
    var todayRule = rules.find(function (rule) {
      return rule.isoWeekday === parts.isoWeekday;
    });
    var todayEndsAt;
    var candidates;

    if (!rules.length) return emptyTimerState();

    if (todayRule) {
      todayEndsAt = zonedTimeToUtc(
        parts.year,
        parts.month,
        parts.day,
        todayRule.hour,
        todayRule.minute,
        timezone,
      );

      if (todayEndsAt.getTime() <= now.getTime()) {
        return buildTimerState(now, todayEndsAt);
      }
    }

    candidates = rules
      .flatMap(function (rule) {
        return buildWeeklyCandidates(rule, now, timezone);
      })
      .filter(function (endsAt) {
        return endsAt.getTime() > now.getTime();
      })
      .sort(function (first, second) {
        return first.getTime() - second.getTime();
      });

    return candidates[0]
      ? buildTimerState(now, candidates[0])
      : emptyTimerState();
  }

  function buildTimerState(now, endsAt) {
    var isExpired;
    var remainingMs;

    if (!endsAt) return emptyTimerState();

    isExpired = endsAt.getTime() <= now.getTime();
    remainingMs = Math.max(0, endsAt.getTime() - now.getTime());

    return {
      isActive: !isExpired,
      isExpired: isExpired,
      remainingMs: remainingMs,
      endsAt: endsAt,
    };
  }

  function emptyTimerState() {
    return {
      isActive: false,
      isExpired: false,
      remainingMs: 0,
      endsAt: null,
    };
  }

  function getCutoff(timer) {
    var firstRule = Array.isArray(timer.recurringDays)
      ? timer.recurringDays.find(isObject)
      : isObject(timer.recurringDays)
        ? timer.recurringDays
        : null;
    var hour = readHour(
      timer.cutoffHour ??
        (firstRule && firstRule.cutoffHour) ??
        (firstRule && firstRule.hour),
    );
    var minute = readMinute(
      timer.cutoffMinute ??
        (firstRule && firstRule.cutoffMinute) ??
        (firstRule && firstRule.minute) ??
        0,
    );

    return hour === null || minute === null
      ? null
      : { hour: hour, minute: minute };
  }

  function getWeeklyRules(timer) {
    var fallback = getCutoff(timer) || { hour: 23, minute: 59 };
    var rules = Array.isArray(timer.recurringDays) ? timer.recurringDays : [];

    return rules
      .filter(isObject)
      .map(function (rule) {
        var isoWeekday = normalizeIsoWeekday(rule.weekday || rule.day);
        var hour = readHour(rule.cutoffHour ?? rule.hour ?? fallback.hour);
        var minute = readMinute(
          rule.cutoffMinute ?? rule.minute ?? fallback.minute,
        );

        return isoWeekday && hour !== null && minute !== null
          ? { isoWeekday: isoWeekday, hour: hour, minute: minute }
          : null;
      })
      .filter(Boolean);
  }

  function buildWeeklyCandidates(rule, now, timezone) {
    var parts = getZonedParts(now, timezone);
    var localMidnight = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      0,
      0,
      timezone,
    );
    var daysUntil = (rule.isoWeekday - parts.isoWeekday + 7) % 7;

    return [daysUntil, daysUntil + 7].map(function (daysToAdd) {
      var candidateParts = getZonedParts(
        new Date(localMidnight.getTime() + daysToAdd * 86400000),
        timezone,
      );

      return zonedTimeToUtc(
        candidateParts.year,
        candidateParts.month,
        candidateParts.day,
        rule.hour,
        rule.minute,
        timezone,
      );
    });
  }

  function shouldReuseStorage(startedAt, now, timezone, resetBehavior) {
    if (resetBehavior === "DAILY") {
      return isSameZonedDay(startedAt, now, timezone);
    }

    if (resetBehavior === "WEEKLY") {
      return isSameZonedWeek(startedAt, now, timezone);
    }

    return true;
  }

  function getEvergreenStorage(resetBehavior) {
    return safeStorage(
      resetBehavior === "ON_SESSION_END" ? "sessionStorage" : "localStorage",
    );
  }

  function readStorage(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
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

  function safeStorage(storageName) {
    try {
      return window[storageName] || null;
    } catch {
      return null;
    }
  }

  function isSameZonedDay(first, second, timezone) {
    var firstParts = getZonedParts(first, timezone);
    var secondParts = getZonedParts(second, timezone);

    return (
      firstParts.year === secondParts.year &&
      firstParts.month === secondParts.month &&
      firstParts.day === secondParts.day
    );
  }

  function isSameZonedWeek(first, second, timezone) {
    var firstParts = getZonedParts(first, timezone);
    var secondParts = getZonedParts(second, timezone);

    return (
      getWeekStart(firstParts, timezone).getTime() ===
      getWeekStart(secondParts, timezone).getTime()
    );
  }

  function getWeekStart(parts, timezone) {
    var localMidnight = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      0,
      0,
      timezone,
    );

    return new Date(
      localMidnight.getTime() - (parts.isoWeekday - 1) * 86400000,
    );
  }

  function getZonedParts(date, timezone) {
    var formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimezone(timezone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    var parts = {};
    var weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

    formatter.formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
      isoWeekday: weekdayMap[parts.weekday] || 1,
    };
  }

  function zonedTimeToUtc(year, month, day, hour, minute, timezone) {
    var localTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0);
    var utcTimestamp = localTimestamp;
    var index;
    var offset;

    for (index = 0; index < 3; index += 1) {
      offset =
        getZonedTimestamp(new Date(utcTimestamp), timezone) - utcTimestamp;
      utcTimestamp = localTimestamp - offset;
    }

    return new Date(utcTimestamp);
  }

  function getZonedTimestamp(date, timezone) {
    var parts = getZonedParts(date, timezone);

    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
  }

  function buildTimerParts(ms, design) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var showDays = !design || design.timerHideZeroDays === false || days > 0;
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var parts = [];

    if (showDays) {
      parts.push(
        timerPart("days", days, timerUnitLabel(design, "days"), "Days"),
      );
    }

    parts.push(
      timerPart(
        "hours",
        showDays ? hours : Math.floor(totalSeconds / 3600),
        timerUnitLabel(design, "hours"),
        "Hrs",
      ),
    );
    parts.push(
      timerPart("minutes", minutes, timerUnitLabel(design, "minutes"), "Mins"),
    );
    parts.push(
      timerPart("seconds", seconds, timerUnitLabel(design, "seconds"), "Secs"),
    );

    return parts;
  }

  function timerPart(key, value, label, shortLabel) {
    return {
      key: key,
      value: pad(value),
      label: label,
      shortLabel: shortLabel,
    };
  }

  function formatTimerPartsAsColon(parts) {
    return parts
      .map(function (part) {
        return part.value;
      })
      .join(":");
  }

  function safeTimerStyle(value) {
    return value === "GROUPED" || value === "BOXES" ? value : "PLAIN";
  }

  function safeTimerFormat(value) {
    return value === "COLON" ? "COLON" : "UNITS";
  }

  function timerUnitLabel(design, unit) {
    if (unit === "days") return design.timerDaysLabel || "Days";
    if (unit === "hours") return design.timerHoursLabel || "Hrs";
    if (unit === "minutes") return design.timerMinutesLabel || "Mins";
    return design.timerSecondsLabel || "Secs";
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function readHour(value) {
    var hour = Number(value);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  function readMinute(value) {
    var minute = Number(value);
    return Number.isInteger(minute) && minute >= 0 && minute <= 59
      ? minute
      : null;
  }

  function normalizeIsoWeekday(value) {
    var weekdays = {
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
      sunday: 7,
      sun: 7,
    };
    var normalized;

    if (typeof value === "number") {
      if (value >= 1 && value <= 7) return value;
      if (value === 0) return 7;
    }

    if (typeof value !== "string") return null;

    normalized = value.trim().toLowerCase();

    return weekdays[normalized] || null;
  }

  function safeTimezone(timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return timezone;
    } catch {
      return "UTC";
    }
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

  function detectShop(element) {
    return (
      element.dataset.shop ||
      (window.Shopify && window.Shopify.shop) ||
      window.location.hostname
    );
  }

  function detectLocale(element) {
    return (
      element.dataset.locale ||
      element.dataset.defaultLocale ||
      document.documentElement.lang ||
      window.navigator.language ||
      "en"
    );
  }

  function detectCountry(element) {
    return (
      element.dataset.country ||
      (window.Shopify && window.Shopify.country) ||
      ""
    );
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

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, Math.round(number)))
      : fallback;
  }

  function isSafeUrl(url) {
    return url ? url.charAt(0) === "/" || /^https?:\/\//i.test(url) : false;
  }

  function isObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function pad(value) {
    return String(value).padStart(2, "0");
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

    window.PromoPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;

    if (settings.defaultLocale && !config.locale) {
      config.locale = settings.defaultLocale;
    }
    config.currency = config.currency || settings.defaultCurrency || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
