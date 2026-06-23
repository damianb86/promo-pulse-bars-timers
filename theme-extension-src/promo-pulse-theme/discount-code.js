(function () {
  "use strict";

  var visitorIdStorageKey = "promo_pulse_visitor_id";
  var sessionIdStorageKey = "promo_pulse_session_id";
  var attributionStorageKey = "promo_pulse_last_seen_campaign";
  var lastSeenCampaignIdStorageKey = "promo_pulse_last_seen_campaign_id";
  var lastSeenExperimentIdStorageKey = "promo_pulse_last_seen_experiment_id";
  var lastSeenVariantIdStorageKey = "promo_pulse_last_seen_variant_id";
  var lastPromoTouchStorageKey = "promo_pulse_last_promo_touch";
  var uniqueCodeRequestCache = {};
  var trackedOnceEvents = {};
  var commerceEventTimestamps = {};
  var uniqueCodeRequestTtlMs = 30000;
  var commerceEventDedupeMs = 3000;
  var attributionMaxAgeMs = 24 * 60 * 60 * 1000;
  var memoryVisitorId = "";
  var memorySessionId = "";
  var lastRememberedCampaign = null;

  installFetchGuard();

  if (!window.PromoPulseAnalyticsReady) {
    window.PromoPulseAnalyticsReady = true;

    window.PromoPulseTrackEvent = function (eventType, campaign, extra) {
      var root = getRoot();
      var campaignId = campaign && (campaign.id || campaign.campaignId);
      var shop = detectShop(root);
      var tracking;
      var payload;

      if (!shop || !campaignId) return;
      if (!analyticsAllowed()) return;
      if (isPaused("PromoPulseProxyPausedUntil")) return;
      if (wasTrackedOnce(eventType, campaign)) return;

      tracking = getVisitorSessionTracking(campaign);
      rememberCampaign(campaign, tracking);

      payload = {
        shop: shop,
        campaignId: campaignId,
        experimentId: tracking.experimentId,
        variantId: tracking.variantId,
        visitorId: tracking.visitorId,
        eventType: eventType,
        placementType: campaign.placement || campaign.placementType || null,
        sessionId: tracking.sessionId,
        cartToken: root ? root.dataset.cartToken || null : null,
        currencyCode: root ? root.dataset.cartCurrency || null : null,
        country: root ? root.dataset.country || null : null,
        locale:
          (root && (root.dataset.locale || root.dataset.defaultLocale)) ||
          document.documentElement.lang ||
          window.navigator.language ||
          "en",
        path: window.location.pathname,
        userAgent: window.navigator.userAgent,
        doNotTrack: isDoNotTrackEnabled(),
        consentGranted: hasAnalyticsConsent(),
      };

      if (extra) {
        Object.keys(extra).forEach(function (key) {
          payload[key] = extra[key];
        });
      }

      try {
        window
          .fetch(getAnalyticsPath(root), {
            method: "POST",
            credentials: "same-origin",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          .catch(function () {});
      } catch (error) {
        debug(root, error);
      }
    };

    window.PromoPulseTrackCopy = function (campaign) {
      window.PromoPulseTrackEvent("COPY_CODE", campaign);
    };

    document.addEventListener("promo-pulse:impression", function (event) {
      window.PromoPulseTrackEvent("IMPRESSION", event.detail || {});
    });

    document.addEventListener("promo-pulse:click", function (event) {
      window.PromoPulseTrackEvent("CLICK", event.detail || {});
    });

    document.addEventListener("promo-pulse:copy-code", function (event) {
      window.PromoPulseTrackEvent("COPY_CODE", event.detail || {});
    });

    document.addEventListener("promo-pulse:badge-impression", function (event) {
      window.PromoPulseTrackEvent("BADGE_IMPRESSION", event.detail || {});
    });

    document.addEventListener("promo-pulse:badge-click", function (event) {
      window.PromoPulseTrackEvent("BADGE_CLICK", event.detail || {});
    });
  }

  window.PromoPulseGetVisitorSessionTracking = function (options) {
    var includeIdentity =
      isFunctionalTrackingRequest(options) || analyticsAllowed();

    return {
      visitorId: includeIdentity ? getVisitorId() : "",
      sessionId: includeIdentity ? getSessionId() : "",
      doNotTrack: isDoNotTrackEnabled(),
      consentGranted: hasAnalyticsConsent(),
    };
  };

  if (!window.PromoPulseCommerceTrackingReady) {
    window.PromoPulseCommerceTrackingReady = true;
    installCommerceTracking();
  }

  window.PromoPulseCopyCode = function (code, campaign) {
    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(code).catch(function () {});
    }

    document.dispatchEvent(
      new CustomEvent("promo-pulse:copy-code", {
        detail: buildCampaignTrackingDetail(campaign),
      }),
    );
  };

  window.CPcb = window.PromoPulseCouponButton = function (code, campaign) {
    if (
      campaign &&
      campaign.discount &&
      campaign.discount.uniqueCode &&
      campaign.discount.uniqueCode.endpoint
    ) {
      return renderUniqueCodeWidget(campaign, campaign.discount.uniqueCode);
    }

    var button = document.createElement("button");
    button.className = "pp-code";
    button.type = "button";
    button.textContent = code;
    button.onclick = function () {
      window.PromoPulseCopyCode(code, campaign);
    };
    return button;
  };

  window.PromoPulseApplyExperiment = function (campaign) {
    var experiment = campaign && campaign.experiment;
    var variants =
      experiment && Array.isArray(experiment.variants)
        ? experiment.variants.filter(isAssignableExperimentVariant)
        : [];
    var visitorId;
    var assignmentKey;
    var assignedVariantId;
    var variant;
    var nextCampaign;

    if (!campaign || !experiment || experiment.status !== "RUNNING") {
      return campaign;
    }

    if (!experiment.id || variants.length === 0) return campaign;
    if (!analyticsAllowed()) return campaign;

    visitorId = getVisitorId();
    assignmentKey = "promo_pulse_experiment_assignment_" + experiment.id;
    assignedVariantId = readStoredValue("localStorage", assignmentKey);
    variant = findExperimentVariant(variants, assignedVariantId);

    if (!variant) {
      variant = selectExperimentVariant(experiment.id, visitorId, variants);
      if (variant) {
        writeStoredValue("localStorage", assignmentKey, variant.id);
      }
    }

    if (!variant) return campaign;

    nextCampaign = Object.assign({}, campaign, {
      experimentId: experiment.id,
      variantId: variant.id,
      experiment: {
        id: experiment.id,
        name: experiment.name,
        primaryMetric: experiment.primaryMetric,
        trafficSplitStrategy: experiment.trafficSplitStrategy,
        status: experiment.status,
      },
      variant: {
        id: variant.id,
        name: variant.name,
      },
      texts: mergePlainObjects(campaign.texts, variant.textOverride),
      design: mergePlainObjects(campaign.design, variant.designOverride),
      discount: mergePlainObjects(campaign.discount, variant.discountOverride),
    });

    applyPlacementOverride(nextCampaign, variant.placementOverride);

    return nextCampaign;
  };

  function isAssignableExperimentVariant(variant) {
    return (
      variant &&
      (variant.status === "ACTIVE" || variant.status === "WINNER") &&
      Number(variant.weight) > 0
    );
  }

  function findExperimentVariant(variants, variantId) {
    if (!variantId) return null;

    return (
      variants.find(function (variant) {
        return variant.id === variantId;
      }) || null
    );
  }

  function selectExperimentVariant(experimentId, visitorId, variants) {
    var totalWeight = variants.reduce(function (total, variant) {
      return total + Math.max(0, Math.trunc(Number(variant.weight) || 0));
    }, 0);
    var bucket;
    var cumulativeWeight = 0;
    var index;

    if (!visitorId || totalWeight <= 0) return null;

    bucket = hashAssignmentBucket(experimentId + ":" + visitorId) % totalWeight;

    for (index = 0; index < variants.length; index += 1) {
      cumulativeWeight += Math.max(
        0,
        Math.trunc(Number(variants[index].weight) || 0),
      );
      if (bucket < cumulativeWeight) return variants[index];
    }

    return variants[variants.length - 1] || null;
  }

  function hashAssignmentBucket(value) {
    var hash = 2166136261;
    var index;

    for (index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function mergePlainObjects(base, override) {
    var output =
      base && typeof base === "object" && !Array.isArray(base)
        ? Object.assign({}, base)
        : {};

    if (!override || typeof override !== "object" || Array.isArray(override)) {
      return output;
    }

    Object.keys(override).forEach(function (key) {
      output[key] = override[key];
    });

    return output;
  }

  function applyPlacementOverride(campaign, override) {
    if (!override) return;

    if (typeof override === "string") {
      campaign.placement = override;
      return;
    }

    if (typeof override !== "object" || Array.isArray(override)) return;

    if (typeof override.placement === "string") {
      campaign.placement = override.placement;
    }
    if (typeof override.placementType === "string") {
      campaign.placement = override.placementType;
    }
    if (typeof override.placementSelector === "string") {
      campaign.placementSelector = override.placementSelector;
    }
    if (typeof override.customSelector === "string") {
      campaign.placementSelector = override.customSelector;
    }
  }

  function renderUniqueCodeWidget(campaign, config) {
    var wrapper = document.createElement("span");
    var loading = document.createElement("span");

    wrapper.className = "pp-unique-code";
    wrapper.dataset.testid = "unique-code";
    loading.className = "pp-unique-code__loading";
    loading.textContent = "Loading code";
    wrapper.appendChild(loading);

    requestUniqueCode(campaign, config)
      .then(function (payload) {
        renderAssignedUniqueCode(wrapper, campaign, config, payload);
      })
      .catch(function (error) {
        debug(getRoot(), error);
        renderExpiredUniqueCode(wrapper, campaign);
      });

    return wrapper;
  }

  function requestUniqueCode(campaign, config) {
    var root = getRoot();
    var tracking = getVisitorSessionTracking(campaign, {
      purpose: "uniqueCode",
    });
    var cacheKey;
    var cached;
    var request;
    var payload = {
      shop: detectShop(root),
      campaignId: campaign && (campaign.id || campaign.campaignId),
      visitorId: tracking.visitorId,
      sessionId: tracking.sessionId,
      redirectPath: getCurrentPath(),
    };

    if (analyticsAllowed()) {
      rememberCampaign(campaign, tracking);
    }

    cacheKey = [
      payload.shop,
      payload.campaignId,
      payload.visitorId,
      payload.sessionId || "",
      getStorefrontApiPath(root, config.endpoint),
    ].join(":");
    cached = uniqueCodeRequestCache[cacheKey];

    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise.then(clonePlainObject);
    }

    request = window
      .fetch(getStorefrontApiPath(root, config.endpoint), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            var error;

            if (!response.ok || !body.code) {
              error = new Error(body.error || "Unique code unavailable.");
              error.status = response.status;
              throw error;
            }

            body.tracking = tracking;
            return body;
          });
      });

    uniqueCodeRequestCache[cacheKey] = {
      expiresAt: Date.now() + uniqueCodeRequestTtlMs,
      promise: request,
    };

    request.catch(function () {
      delete uniqueCodeRequestCache[cacheKey];
    });

    return request.then(clonePlainObject);
  }

  function renderAssignedUniqueCode(wrapper, campaign, config, payload) {
    var value = document.createElement("span");
    var copyButton = document.createElement("button");
    var timer = document.createElement("span");
    var applyLink;

    wrapper.replaceChildren();
    value.className = "pp-unique-code__value";
    value.dataset.testid = "unique-code";
    value.textContent = payload.code;
    wrapper.appendChild(value);

    copyButton.className = "pp-code";
    copyButton.dataset.testid = "copy-code-button";
    copyButton.type = "button";
    copyButton.textContent = "Copy code";
    copyButton.setAttribute("aria-label", "Copy code " + payload.code);
    copyButton.addEventListener("click", function () {
      window.PromoPulseCopyCode(payload.code, campaign);
    });
    wrapper.appendChild(copyButton);

    if (isSafeDiscountApplyUrl(payload.discountApplyUrl)) {
      applyLink = document.createElement("a");
      applyLink.className = "pp-cta";
      applyLink.href = payload.discountApplyUrl;
      applyLink.textContent = "Apply discount";
      applyLink.setAttribute("aria-label", "Apply discount " + payload.code);
      applyLink.addEventListener("click", function () {
        window.PromoPulseTrackEvent("APPLY_CODE_CLICKED", campaign);
      });
      wrapper.appendChild(applyLink);
    }

    if (payload.expiresAt) {
      timer.className = "pp-unique-code__timer";
      timer.setAttribute("aria-live", "polite");
      timer.setAttribute("aria-label", "Code time remaining");
      wrapper.appendChild(timer);
      startUniqueCodeCountdown(wrapper, timer, campaign, config, payload);
    }

    window.PromoPulseTrackEvent("UNIQUE_CODE_ASSIGNED", campaign, {
      reused: payload.reused === true,
    });
  }

  function startUniqueCodeCountdown(wrapper, timer, campaign, config, payload) {
    var expiresAt = parseDate(payload.expiresAt);
    var expired = false;
    var interval;

    if (!expiresAt) return;

    function tick() {
      var remainingMs = expiresAt.getTime() - Date.now();

      if (remainingMs <= 0) {
        if (expired) return;
        expired = true;
        window.clearInterval(interval);
        renderExpiredUniqueCode(wrapper, campaign);
        expireUniqueCode(campaign, config, payload.tracking);
        return;
      }

      timer.textContent = formatDuration(remainingMs);
    }

    tick();
    interval = window.setInterval(tick, 1000);
  }

  function expireUniqueCode(campaign, config, tracking) {
    var root = getRoot();

    if (!tracking || !tracking.visitorId) return;

    try {
      window
        .fetch(getStorefrontApiPath(root, config.endpoint), {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "expire",
            shop: detectShop(root),
            campaignId: campaign && (campaign.id || campaign.campaignId),
            visitorId: tracking.visitorId,
            sessionId: tracking.sessionId,
          }),
        })
        .catch(function () {});
    } catch (error) {
      debug(root, error);
    }
  }

  function renderExpiredUniqueCode(wrapper, campaign) {
    var expired = document.createElement("span");
    var texts = (campaign && campaign.texts) || {};

    expired.className = "pp-unique-code__expired";
    expired.textContent =
      texts.expiredText || "This code is no longer available.";
    wrapper.replaceChildren(expired);
  }

  function getStorefrontApiPath(root, endpoint) {
    var apiBaseUrl = getApiBaseUrl(root);
    var value = String(endpoint || "/api/storefront/unique-code/assign").trim();

    if (/^https?:\/\//i.test(value)) return value;
    if (apiBaseUrl && value.charAt(0) === "/") return apiBaseUrl + value;
    if (value === "/api/storefront/unique-code/assign") {
      return "/apps/promo-pulse" + value;
    }

    return value || "/api/storefront/unique-code/assign";
  }

  function getCurrentPath() {
    return window.location.pathname || "/";
  }

  function isSafeDiscountApplyUrl(value) {
    return typeof value === "string" && /^\/discount\/[^/]/.test(value);
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function formatDuration(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    if (days > 0) {
      return days + "d " + pad(hours) + "h " + pad(minutes) + "m";
    }

    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function getRoot() {
    return (
      document.getElementById("promo-pulse-app-embed") ||
      document.querySelector(".pp-root")
    );
  }

  function detectShop(root) {
    return (
      (root && root.dataset.shop) ||
      (window.Shopify && window.Shopify.shop) ||
      window.location.hostname
    );
  }

  function getAnalyticsPath(root) {
    var apiBaseUrl = getApiBaseUrl(root);

    if (apiBaseUrl) return apiBaseUrl + "/api/analytics/event";

    return (
      window.PromoPulseAnalyticsEndpoint ||
      (root && root.dataset.analyticsPath) ||
      "/apps/promo-pulse"
    );
  }

  function getApiBaseUrl(root) {
    var value =
      window.PromoPulseApiBaseUrl || (root && root.dataset.apiBaseUrl) || "";

    value = String(value).trim().replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "";

    return value;
  }

  function analyticsAllowed() {
    var settings = window.PromoPulseSettings || {};

    if (settings.analyticsEnabled === false) return false;

    if (settings.respectDoNotTrack !== false && isDoNotTrackEnabled()) {
      return false;
    }

    if (settings.consentMode === "STRICT" && hasAnalyticsConsent() !== true) {
      return false;
    }

    return true;
  }

  function isDoNotTrackEnabled() {
    return (
      window.navigator.doNotTrack === "1" ||
      window.navigator.doNotTrack === "yes" ||
      window.doNotTrack === "1"
    );
  }

  function hasAnalyticsConsent() {
    var privacy = window.Shopify && window.Shopify.customerPrivacy;

    if (privacy && typeof privacy.analyticsProcessingAllowed === "function") {
      return privacy.analyticsProcessingAllowed() === true;
    }

    return null;
  }

  function isFunctionalTrackingRequest(options) {
    return options && options.purpose === "uniqueCode";
  }

  function installCommerceTracking() {
    trackCheckoutPageLoad();

    document.addEventListener(
      "submit",
      function (event) {
        var target = event && event.target;

        if (isAddToCartForm(target)) {
          trackRecentCampaignEvent("ADD_TO_CART");
          return;
        }

        if (isCheckoutForm(target)) {
          trackRecentCampaignEvent("CHECKOUT_STARTED");
        }
      },
      true,
    );

    document.addEventListener(
      "click",
      function (event) {
        var target = event && event.target;

        if (isCheckoutTrigger(target)) {
          trackRecentCampaignEvent("CHECKOUT_STARTED");
          return;
        }

        if (isAddToCartTrigger(target)) {
          trackRecentCampaignEvent("ADD_TO_CART");
        }
      },
      true,
    );
  }

  function trackCheckoutPageLoad() {
    if (isCheckoutPath(window.location && window.location.pathname)) {
      trackRecentCampaignEvent("CHECKOUT_STARTED");
    }
  }

  function trackRecentCampaignEvent(eventType) {
    var campaign = readRecentCampaign();
    var extra;

    if (!campaign) return;
    if (wasCommerceEventTrackedRecently(eventType, campaign)) return;

    extra = buildCommerceEventExtra();
    window.PromoPulseTrackEvent(eventType, campaign, extra);
  }

  function buildCommerceEventExtra() {
    var cartState =
      window.PromoPulseGetCartState &&
      window.PromoPulseGetCartState(attributionMaxAgeMs);
    var extra = {};
    var cartToken =
      (cartState && cartState.token) || window.PromoPulseCartToken || "";
    var currencyCode =
      (cartState && cartState.currency) || window.PromoPulseCartCurrency || "";

    if (cartToken) extra.cartToken = cartToken;
    if (currencyCode) extra.currencyCode = currencyCode;

    return extra;
  }

  function wasCommerceEventTrackedRecently(eventType, campaign) {
    var now = Date.now();
    var key = [
      String(eventType || "").toUpperCase(),
      campaign.campaignId || campaign.id || "",
      campaign.variantId || "",
      readStoredValue("sessionStorage", sessionIdStorageKey) ||
        memorySessionId ||
        "",
    ].join(":");
    var previous = commerceEventTimestamps[key] || 0;

    if (previous && now - previous < commerceEventDedupeMs) return true;

    commerceEventTimestamps[key] = now;
    return false;
  }

  function readRecentCampaign() {
    var attribution = normalizeAttributionState(lastRememberedCampaign);
    var storedValue;
    var campaignId;
    var lastPromoTouch;

    if (attribution) return attribution;

    try {
      storedValue = JSON.parse(
        readStoredValue("localStorage", attributionStorageKey) || "null",
      );
    } catch {
      storedValue = null;
    }

    attribution = normalizeAttributionState(storedValue);
    if (attribution) return attribution;

    campaignId = readStoredValue("localStorage", lastSeenCampaignIdStorageKey);
    lastPromoTouch = Number(
      readStoredValue("localStorage", lastPromoTouchStorageKey),
    );

    return normalizeAttributionState({
      campaignId: campaignId,
      experimentId: readStoredValue(
        "localStorage",
        lastSeenExperimentIdStorageKey,
      ),
      variantId: readStoredValue("localStorage", lastSeenVariantIdStorageKey),
      lastPromoTouch: lastPromoTouch,
    });
  }

  function normalizeAttributionState(value) {
    var campaignId = value && (value.campaignId || value.id);
    var lastPromoTouch = Number(
      value && (value.lastPromoTouch || value.seenAt),
    );
    var placementType = value && (value.placementType || value.placement);

    if (!campaignId) return null;
    if (!Number.isFinite(lastPromoTouch)) return null;
    if (Date.now() - lastPromoTouch > attributionMaxAgeMs) return null;

    return {
      id: campaignId,
      campaignId: campaignId,
      experimentId: (value && value.experimentId) || null,
      variantId: (value && value.variantId) || null,
      placement: placementType || null,
      placementType: placementType || null,
    };
  }

  function isAddToCartTrigger(target) {
    var element = findClosestElement(target, "button,input,a,[role='button']");
    var form = element && findClosestElement(element, "form");

    if (!element) return false;
    if (isAddToCartForm(form)) return true;
    if (String(element.tagName || "").toUpperCase() === "A") return false;

    return isAddToCartText(readElementText(element));
  }

  function isCheckoutTrigger(target) {
    var element = findClosestElement(target, "a,button,input,[role='button']");
    var form = element && findClosestElement(element, "form");
    var href = element && readElementAttribute(element, "href");
    var name = element && readElementAttribute(element, "name");

    if (!element) return false;
    if (isCheckoutPath(href)) return true;
    if (isCheckoutForm(form)) return true;
    if (String(name || "").toLowerCase() === "checkout") return true;

    return isCheckoutText(readElementText(element));
  }

  function isAddToCartForm(form) {
    var action = form && readElementAttribute(form, "action");

    return /\/cart\/add(?:\.js)?(?:[?#/]|$)/i.test(action || "");
  }

  function isCheckoutForm(form) {
    var action = form && readElementAttribute(form, "action");

    return isCheckoutPath(action);
  }

  function isCheckoutPath(value) {
    return /(^|\/)(checkouts?|cart\/checkout)(?:[/?#]|$)/i.test(
      String(value || ""),
    );
  }

  function isAddToCartText(value) {
    return /\b(add[\s_-]*(to[\s_-]*)?cart|addtocart|agregar[\s_-]*(al[\s_-]*)?carrito)\b/i.test(
      value || "",
    );
  }

  function isCheckoutText(value) {
    return /\b(checkout|check[\s_-]*out|finalizar[\s_-]*compra|ir[\s_-]*a[\s_-]*pagar)\b/i.test(
      value || "",
    );
  }

  function findClosestElement(target, selector) {
    var element = target;

    if (element && element.nodeType === 3) {
      element = element.parentElement;
    }

    if (!element || typeof element.closest !== "function") return null;

    try {
      return element.closest(selector);
    } catch {
      return null;
    }
  }

  function readElementAttribute(element, name) {
    if (!element || typeof element.getAttribute !== "function") return "";

    return element.getAttribute(name) || "";
  }

  function readElementText(element) {
    return [
      readElementAttribute(element, "aria-label"),
      readElementAttribute(element, "name"),
      readElementAttribute(element, "value"),
      element && element.id,
      element && element.className,
      element && element.textContent,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getVisitorSessionTracking(campaign, options) {
    var publicTracking = window.PromoPulseGetVisitorSessionTracking(options);
    var touchTime = Date.now();

    return {
      visitorId: publicTracking.visitorId,
      sessionId: publicTracking.sessionId,
      campaignId: campaign && (campaign.id || campaign.campaignId),
      experimentId: readExperimentId(campaign),
      variantId: readVariantId(campaign),
      placementType: campaign && (campaign.placement || campaign.placementType),
      lastPromoTouch: touchTime,
    };
  }

  function getVisitorId() {
    var value = readStoredValue("localStorage", visitorIdStorageKey);

    if (value) return value;
    if (memoryVisitorId) return memoryVisitorId;

    value = createTrackingId("cpv");
    memoryVisitorId = value;
    writeStoredValue("localStorage", visitorIdStorageKey, value);

    return value;
  }

  function getSessionId() {
    var value = readStoredValue("sessionStorage", sessionIdStorageKey);

    if (value) return value;
    if (memorySessionId) return memorySessionId;

    value = createTrackingId("cps");
    memorySessionId = value;
    writeStoredValue("sessionStorage", sessionIdStorageKey, value);

    return value;
  }

  function readStoredValue(storageName, key) {
    var storage;
    var value;

    try {
      storage = window[storageName];
      if (!storage) return "";
      value = storage.getItem(key);
    } catch {
      value = "";
    }

    return typeof value === "string" ? value : "";
  }

  function writeStoredValue(storageName, key, value) {
    var storage;

    try {
      storage = window[storageName];
      if (storage) storage.setItem(key, value);
    } catch (error) {
      debug(getRoot(), error);
    }
  }

  function createTrackingId(prefix) {
    var value =
      (window.crypto &&
        window.crypto.randomUUID &&
        window.crypto.randomUUID()) ||
      Date.now().toString(36) + Math.random().toString(36).slice(2);

    return prefix + "_" + value;
  }

  function rememberCampaign(campaign, tracking) {
    var campaignId = tracking && tracking.campaignId;
    var placementType = tracking && tracking.placementType;

    if (!campaignId) return;
    if (!analyticsAllowed()) return;

    lastRememberedCampaign = {
      campaignId: campaignId,
      experimentId: tracking.experimentId,
      variantId: tracking.variantId,
      placementType: placementType || null,
      lastPromoTouch: tracking.lastPromoTouch,
      seenAt: tracking.lastPromoTouch,
    };

    try {
      writeStoredValue(
        "localStorage",
        lastSeenCampaignIdStorageKey,
        campaignId,
      );
      writeStoredValue(
        "localStorage",
        lastSeenExperimentIdStorageKey,
        tracking.experimentId || "",
      );
      writeStoredValue(
        "localStorage",
        lastSeenVariantIdStorageKey,
        tracking.variantId || "",
      );
      writeStoredValue(
        "localStorage",
        lastPromoTouchStorageKey,
        String(tracking.lastPromoTouch),
      );
      writeStoredValue(
        "localStorage",
        attributionStorageKey,
        JSON.stringify({
          campaignId: campaignId,
          experimentId: tracking.experimentId,
          variantId: tracking.variantId,
          visitorId: tracking.visitorId,
          sessionId: tracking.sessionId,
          placementType: placementType || null,
          lastPromoTouch: tracking.lastPromoTouch,
          seenAt: tracking.lastPromoTouch,
        }),
      );
    } catch (error) {
      debug(getRoot(), error);
    }
  }

  function clonePlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.assign({}, value)
      : value;
  }

  function buildCampaignTrackingDetail(campaign) {
    return {
      campaignId: campaign && (campaign.id || campaign.campaignId),
      experimentId: readExperimentId(campaign),
      variantId: readVariantId(campaign),
      placement: campaign && (campaign.placement || campaign.placementType),
    };
  }

  function readExperimentId(campaign) {
    return (
      (campaign &&
        (campaign.experimentId ||
          (campaign.experiment && campaign.experiment.id) ||
          campaign.testId)) ||
      null
    );
  }

  function readVariantId(campaign) {
    return (
      (campaign &&
        (campaign.variantId ||
          campaign.experimentVariantId ||
          (campaign.variant && campaign.variant.id))) ||
      null
    );
  }

  function debug(root, error) {
    if (
      ((root && root.dataset.debug === "true") ||
        (window.PromoPulseSettings || {}).enableDebugMode === true) &&
      window.console
    ) {
      window.console.log("[PromoPulse analytics]", error);
    }
  }

  function wasTrackedOnce(eventType, campaign) {
    var type = String(eventType || "").toUpperCase();
    var campaignId = campaign && (campaign.id || campaign.campaignId);
    var key;

    if (
      type !== "IMPRESSION" &&
      type !== "BADGE_IMPRESSION" &&
      type !== "UNIQUE_CODE_ASSIGNED"
    ) {
      return false;
    }

    key = [
      type,
      campaignId || "",
      campaign && (campaign.placement || campaign.placementType || ""),
      campaign && (campaign.variantId || ""),
    ].join(":");

    if (trackedOnceEvents[key]) return true;

    trackedOnceEvents[key] = true;
    return false;
  }

  function installFetchGuard() {
    if (window.PromoPulseFetchGuardReady || !window.fetch) return;

    var nativeFetch = window.fetch.bind(window);
    var pending = {};
    var responseCache = {};
    var proxyCacheTtlMs = 5000;
    var cartCacheTtlMs = 750;
    var proxyPauseMs = 60000;
    var cartPauseMs = 30000;

    window.PromoPulseFetchGuardReady = true;
    window.PromoPulseClearRequestCache = function (kind) {
      if (!kind) {
        responseCache = {};
        return;
      }

      Object.keys(responseCache).forEach(function (key) {
        if (kind === "cart" && key.indexOf("/cart.js") !== -1) {
          delete responseCache[key];
        }
        if (kind === "proxy" && key.indexOf("/cart.js") === -1) {
          delete responseCache[key];
        }
      });
    };
    window.PromoPulseUpdateCartState = updateCartState;
    window.PromoPulseGetCartState = function getPromoPulseCartState(maxAgeMs) {
      var state = window.PromoPulseCartState || null;
      var ageLimit = Number(maxAgeMs || 0);

      if (!state || typeof state.subtotal !== "number") return null;
      if (
        ageLimit > 0 &&
        Date.now() - Number(state.updatedAt || 0) > ageLimit
      ) {
        return null;
      }

      return {
        subtotal: state.subtotal,
        currency: state.currency || window.PromoPulseCartCurrency || "",
        token: state.token || "",
      };
    };
    document.addEventListener("cart:updated", function handleCartUpdated() {
      window.PromoPulseClearRequestCache("cart");
    });

    window.fetch = function (input, init) {
      var request = normalizeRequest(input, init);
      var pauseKey = pauseKeyFor(request.url);
      var cacheKey;
      var cached;

      if (!request.watch) {
        return nativeFetch(input, init);
      }

      if (pauseKey && isPaused(pauseKey)) {
        return Promise.resolve(syntheticResponse(request));
      }

      cacheKey = request.method + ":" + normalizeCacheUrl(request.url);

      if (request.method === "GET") {
        cached = responseCache[cacheKey];
        if (cached && cached.expiresAt > Date.now()) {
          return Promise.resolve(cached.response.clone());
        }

        if (pending[cacheKey]) {
          return pending[cacheKey].then(function (response) {
            return response.clone();
          });
        }
      }

      pending[cacheKey] = nativeFetch(input, sameOriginInit(init))
        .then(function (response) {
          if (isBadStorefrontResponse(response, request)) {
            if (pauseKey) {
              pauseRequests(
                pauseKey,
                request.kind === "cart" ? cartPauseMs : proxyPauseMs,
              );
            }
            debug(
              getRoot(),
              "Paused repeated Promo Pulse storefront requests.",
            );
            return syntheticResponse(request);
          }

          if (request.method === "GET" && response.ok) {
            if (request.kind === "cart") {
              response
                .clone()
                .json()
                .then(updateCartState)
                .catch(function () {});
            }
            responseCache[cacheKey] = {
              response: response.clone(),
              expiresAt:
                Date.now() +
                (request.kind === "cart" ? cartCacheTtlMs : proxyCacheTtlMs),
            };
            pruneResponseCache(responseCache);
          }

          return response;
        })
        .catch(function (error) {
          if (pauseKey) {
            pauseRequests(
              pauseKey,
              request.kind === "cart" ? cartPauseMs : proxyPauseMs,
            );
          }
          debug(getRoot(), error);
          return syntheticResponse(request);
        })
        .finally(function () {
          delete pending[cacheKey];
        });

      return pending[cacheKey].then(function (response) {
        return response.clone();
      });
    };
  }

  function normalizeRequest(input, init) {
    var rawUrl = typeof input === "string" ? input : input && input.url;
    var method = (init && init.method) || (input && input.method) || "GET";
    var url = new URL(rawUrl || "", window.location.href);
    var path = url.pathname;
    var isProxy =
      path === "/apps/promo-pulse" ||
      path.indexOf("/apps/promo-pulse/") === 0 ||
      path.indexOf("/api/storefront/") === 0;
    var isCart = path === "/cart.js";

    return {
      kind: isCart ? "cart" : "proxy",
      method: String(method).toUpperCase(),
      url: url.toString(),
      watch: isProxy || isCart,
    };
  }

  function normalizeCacheUrl(rawUrl) {
    var url = new URL(rawUrl, window.location.href);
    var entries = [];

    url.searchParams.forEach(function (value, key) {
      entries.push([key, value]);
    });
    entries.sort(function (left, right) {
      if (left[0] === right[0]) {
        if (left[1] === right[1]) return 0;
        return left[1] < right[1] ? -1 : 1;
      }
      return left[0] < right[0] ? -1 : 1;
    });

    url.search = "";
    entries.forEach(function (entry) {
      url.searchParams.append(entry[0], entry[1]);
    });

    return url.toString();
  }

  function pruneResponseCache(cache) {
    var now = Date.now();

    Object.keys(cache).forEach(function (key) {
      if (cache[key].expiresAt <= now) {
        delete cache[key];
      }
    });
  }

  function sameOriginInit(init) {
    var nextInit = {};

    if (init) {
      Object.keys(init).forEach(function (key) {
        nextInit[key] = init[key];
      });
    }

    nextInit.credentials = "same-origin";

    return nextInit;
  }

  function updateCartState(cart) {
    var totalCents =
      cart && typeof cart.total_price === "number"
        ? cart.total_price
        : cart && typeof cart.items_subtotal_price === "number"
          ? cart.items_subtotal_price
          : null;
    var subtotal;

    if (totalCents === null) return null;

    subtotal = totalCents / 100;
    window.PromoPulseCartSubtotal = subtotal;
    window.PromoPulseCartCurrency =
      cart.currency || window.PromoPulseCartCurrency || "";
    window.PromoPulseCartToken = cart.token || window.PromoPulseCartToken || "";
    window.PromoPulseCartState = {
      subtotal: subtotal,
      currency: window.PromoPulseCartCurrency,
      token: window.PromoPulseCartToken,
      updatedAt: Date.now(),
    };

    return window.PromoPulseCartState;
  }

  function pauseKeyFor(url) {
    var pathname = new URL(url, window.location.href).pathname;

    if (pathname === "/cart.js") return "PromoPulseCartPausedUntil";
    if (
      pathname === "/apps/promo-pulse" ||
      pathname.indexOf("/apps/promo-pulse/") === 0 ||
      pathname.indexOf("/api/storefront/") === 0
    ) {
      return "PromoPulseProxyPausedUntil";
    }

    return "";
  }

  function isBadStorefrontResponse(response, request) {
    var contentType = response.headers.get("content-type") || "";
    var pathname;

    try {
      pathname = new URL(response.url || request.url, window.location.href)
        .pathname;
    } catch {
      pathname = "";
    }

    if (response.redirected && pathname === "/password") return true;
    if (pathname === "/password") return true;
    if (request.kind === "cart") {
      return contentType.indexOf("application/json") === -1;
    }
    if (request.method === "POST") return false;

    return contentType.indexOf("application/json") === -1;
  }

  function syntheticResponse(request) {
    var body;

    if (request.kind === "cart") {
      body = JSON.stringify({
        total_price:
          typeof window.PromoPulseCartSubtotal === "number"
            ? Math.round(window.PromoPulseCartSubtotal * 100)
            : 0,
        currency: window.PromoPulseCartCurrency || "USD",
        token: "",
      });
    } else if (request.method === "POST") {
      body = JSON.stringify({
        ok: false,
        saved: false,
        ignored: true,
        reason: "storefront_proxy_paused",
      });
    } else if (request.url.indexOf("/badges") !== -1) {
      body = JSON.stringify({
        badges: [],
        settings: window.PromoPulseSettings || null,
      });
    } else {
      body = JSON.stringify({
        campaigns: [],
        settings: window.PromoPulseSettings || null,
      });
    }

    return new Response(body, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      status: 200,
    });
  }

  function isPaused(key) {
    return Number(window[key] || 0) > Date.now();
  }

  function pauseRequests(key, ms) {
    window[key] = Math.max(Number(window[key] || 0), Date.now() + ms);
  }
})();
