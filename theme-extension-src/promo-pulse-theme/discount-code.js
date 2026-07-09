(function () {
  "use strict";

  var visitorIdStorageKey = "promo_pulse_visitor_id";
  var sessionIdStorageKey = "promo_pulse_session_id";
  var appliedDiscountStoragePrefix = "promo_pulse_applied_discount_";
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
  // Analytics events are queued and flushed as one batched POST per page load.
  var analyticsEventQueue = [];
  var analyticsFlushTimer = null;
  var ANALYTICS_MAX_BATCH = 50;
  var ANALYTICS_FLUSH_DELAY_MS = 400;
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
      rememberBehaviorEvent(eventType, campaign, extra);
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

      enqueueAnalyticsEvent(root, payload);
    };

    installAnalyticsFlushHandlers();

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
    if (hasAppliedDiscount(campaign)) {
      return renderAppliedDiscountPlaceholder(campaign);
    }

    if (
      campaign &&
      campaign.discount &&
      campaign.discount.uniqueCode &&
      campaign.discount.uniqueCode.endpoint
    ) {
      return renderUniqueCodeWidget(campaign, campaign.discount.uniqueCode);
    }

    return renderSharedDiscountWidget(code, campaign);
  };

  window.PromoPulseApplyExperiment = function (campaign) {
    return campaign;
  };

  function renderSharedDiscountWidget(code, campaign) {
    var design = getOfferDesign(campaign);
    var wrapper = createOfferWrapper(design, "pp-shared-code");

    if (!code) return wrapper;

    renderDiscountCodeContent(wrapper, campaign, {
      code: code,
      copyTestId: "copy-code-button",
      applyUrl: buildDiscountApplyUrl(code),
      valueClassName: "pp-discount-code__value",
    });

    return wrapper;
  }

  function renderUniqueCodeWidget(campaign, config) {
    var design = getOfferDesign(campaign);
    var wrapper = createOfferWrapper(design, "pp-unique-code");
    var loading = document.createElement("span");

    wrapper.dataset.testid = "unique-code";
    loading.className = "pp-unique-code__loading";
    loading.textContent = "Loading code";
    wrapper.appendChild(loading);

    if (hasAppliedDiscount(campaign)) {
      var behavior = getOfferApplyBehavior(design);
      renderAppliedDiscountState(wrapper, campaign);
      if (behavior === "HIDE_OFFER" || behavior === "CLOSE_CAMPAIGN") {
        window.setTimeout(function () {
          renderPostApplyState(wrapper, campaign);
        }, 0);
      }
      return wrapper;
    }

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
    var timer = document.createElement("span");

    wrapper.replaceChildren();
    renderDiscountCodeContent(wrapper, campaign, {
      code: payload.code,
      copyTestId: "copy-code-button",
      applyUrl: payload.discountApplyUrl,
      valueTestId: "unique-code",
      valueClassName: "pp-discount-code__value pp-unique-code__value",
    });

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

  function renderDiscountCodeContent(wrapper, campaign, options) {
    var design = getOfferDesign(campaign);
    var layout = getOfferCodeLayout(design);
    var code = String(options.code || "");
    var codeGroup;
    var label;
    var value;
    var copyButton;
    var applyLink;

    if (design.showDiscountCode !== false) {
      codeGroup = document.createElement("span");
      codeGroup.className = "pp-discount-code";

      if (getOfferCodeLabel(design)) {
        label = document.createElement("span");
        label.className = "pp-discount-code__label";
        label.textContent = getOfferCodeLabel(design);
        codeGroup.appendChild(label);
      }

      value = document.createElement("span");
      value.className = options.valueClassName || "pp-discount-code__value";
      if (options.valueTestId) value.dataset.testid = options.valueTestId;
      value.textContent = code;
      codeGroup.appendChild(value);
    }

    if (design.showCopyCodeButton !== false) {
      copyButton = document.createElement("button");
      copyButton.className = "pp-code";
      if (options.copyTestId) copyButton.dataset.testid = options.copyTestId;
      copyButton.type = "button";
      copyButton.textContent = getCopyCodeLabel(design);
      copyButton.setAttribute(
        "aria-label",
        getCopyCodeLabel(design) + " " + code,
      );
      copyButton.addEventListener("click", function () {
        window.PromoPulseCopyCode(code, campaign);
        handleOfferCopyBehavior(wrapper, campaign, copyButton);
      });
    }

    if (
      design.showApplyDiscountButton !== false &&
      isSafeDiscountApplyUrl(options.applyUrl)
    ) {
      applyLink = document.createElement("a");
      applyLink.className = "pp-cta pp-cta--offer";
      applyLink.href = options.applyUrl;
      applyLink.textContent = getApplyDiscountLabel(design);
      applyLink.setAttribute(
        "aria-label",
        getApplyDiscountLabel(design) + " " + code,
      );
      applyLink.addEventListener("click", function () {
        window.PromoPulseTrackEvent("APPLY_CODE_CLICKED", campaign);
        markDiscountApplied(campaign, code);
        showApplyFeedback(applyLink);
        window.setTimeout(function () {
          renderPostApplyState(wrapper, campaign);
        }, 80);
      });
    }

    appendOfferLayout(wrapper, layout, codeGroup, copyButton, applyLink);
  }

  function appendOfferLayout(wrapper, layout, codeGroup, copyButton, applyLink) {
    var main;
    var actions;
    var compactCode;

    if (layout === "stacked") {
      if (codeGroup) {
        main = document.createElement("span");
        main.className = "pp-discount-offer__main";
        main.appendChild(codeGroup);
        wrapper.appendChild(main);
      }

      if (copyButton || applyLink) {
        actions = document.createElement("span");
        actions.className = "pp-discount-offer__actions";
        if (copyButton) actions.appendChild(copyButton);
        if (applyLink) actions.appendChild(applyLink);
        wrapper.appendChild(actions);
      }
      return;
    }

    if (layout === "compact") {
      if (codeGroup || copyButton) {
        compactCode = document.createElement("span");
        compactCode.className = "pp-discount-offer__compact-code";
        if (codeGroup) compactCode.appendChild(codeGroup);
        if (copyButton) compactCode.appendChild(copyButton);
        wrapper.appendChild(compactCode);
      }

      if (applyLink) wrapper.appendChild(applyLink);
      return;
    }

    if (codeGroup) wrapper.appendChild(codeGroup);
    if (copyButton) wrapper.appendChild(copyButton);
    if (applyLink) wrapper.appendChild(applyLink);
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

  function createOfferWrapper(design, className) {
    var wrapper = document.createElement("span");
    var layout = getOfferCodeLayout(design);

    wrapper.className =
      "pp-discount-offer pp-discount-offer--layout-" + layout + " " + className;

    return wrapper;
  }

  function renderAppliedDiscountPlaceholder(campaign) {
    var design = getOfferDesign(campaign);
    var wrapper = createOfferWrapper(design, "pp-discount-offer--applied");
    var behavior = getOfferApplyBehavior(design);

    // Paint the applied confirmation synchronously so the offer renders with
    // content on the first frame instead of flashing an empty placeholder.
    renderAppliedDiscountState(wrapper, campaign);

    // HIDE_OFFER / CLOSE_CAMPAIGN need the surface attached to the DOM to find
    // the campaign container, so only those defer to the next tick.
    if (behavior === "HIDE_OFFER" || behavior === "CLOSE_CAMPAIGN") {
      window.setTimeout(function () {
        renderPostApplyState(wrapper, campaign);
      }, 0);
    }

    return wrapper;
  }

  function handleOfferCopyBehavior(wrapper, campaign, button) {
    var design = getOfferDesign(campaign);
    var behavior = getOfferCopyBehavior(design);

    if (behavior === "HIDE_OFFER") {
      hideOffer(wrapper);
      return;
    }

    if (behavior === "CLOSE_CAMPAIGN") {
      closeCampaignFromElement(wrapper);
      return;
    }

    showCopyFeedback(button, getCopiedCodeLabel(design));
  }

  function renderPostApplyState(anchor, campaign) {
    var design = getOfferDesign(campaign);
    var behavior = getOfferApplyBehavior(design);

    if (behavior === "HIDE_OFFER") {
      hideOffer(anchor);
      return;
    }

    if (behavior === "CLOSE_CAMPAIGN") {
      closeCampaignFromElement(anchor);
      return;
    }

    renderAppliedDiscountState(anchor, campaign);
  }

  function hideOffer(anchor) {
    if (!anchor) return;

    anchor.classList.add("pp-discount-offer--hidden");
    window.setTimeout(function () {
      if (anchor.remove) anchor.remove();
    }, 180);
  }

  function closeCampaignFromElement(anchor) {
    var target =
      anchor &&
      anchor.closest &&
      anchor.closest(".pp-bar, .pp-product-card, .pp-cart-card, .pp-root");

    if (target && target.remove) {
      target.remove();
      return;
    }

    hideOffer(anchor);
  }

  function showCopyFeedback(button, copiedLabel) {
    var originalText = button.textContent || "Copy code";

    button.classList.remove("pp-code--copied");
    void button.offsetWidth;
    button.classList.add("pp-code--copied");
    button.textContent = copiedLabel || "Copied";

    window.setTimeout(function () {
      button.classList.remove("pp-code--copied");
      button.textContent = originalText;
    }, 1600);
  }

  function showApplyFeedback(link) {
    link.classList.remove("pp-cta--applied");
    void link.offsetWidth;
    link.classList.add("pp-cta--applied");
    link.textContent = "Applied";
  }

  function markDiscountApplied(campaign, code) {
    var storage = safeLocalStorage();
    var key = getAppliedDiscountStorageKey(campaign);

    if (!storage || !key) return;

    try {
      storage.setItem(
        key,
        JSON.stringify({
          code: code || "",
          appliedAt: Date.now(),
        }),
      );
    } catch {
      return;
    }
  }

  function hasAppliedDiscount(campaign) {
    var storage = safeLocalStorage();
    var key = getAppliedDiscountStorageKey(campaign);
    var value;

    if (!storage || !key) return false;

    try {
      value = storage.getItem(key);
    } catch {
      return false;
    }

    return Boolean(value);
  }

  function getAppliedDiscountStorageKey(campaign) {
    var campaignId = campaign && (campaign.id || campaign.campaignId);
    var visitorId = getVisitorId();

    if (!campaignId || !visitorId) return "";

    return appliedDiscountStoragePrefix + campaignId + "_" + visitorId;
  }

  function renderAppliedDiscountState(anchor, campaign) {
    var target =
      anchor &&
      anchor.closest &&
      anchor.closest(".pp-bar, .pp-product-card, .pp-cart-card, .pp-root");
    var message = document.createElement("div");
    var design = getOfferDesign(campaign);

    message.className = "pp-discount-applied-message";
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    message.textContent = getAppliedDiscountMessage(design);

    if (!target) {
      anchor.replaceChildren(message);
      return;
    }

    target.classList.add("pp-discount-applied");
    target.replaceChildren(message);
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

  function getOfferDesign(campaign) {
    return (campaign && campaign.design) || {};
  }

  function getOfferCodeLayout(design) {
    var value = String((design && design.offerCodeLayout) || "INLINE")
      .trim()
      .toUpperCase();

    if (value === "STACKED") return "stacked";
    if (value === "COMPACT") return "compact";
    return "inline";
  }

  function getOfferCopyBehavior(design) {
    var value = String((design && design.offerCopyBehavior) || "FEEDBACK")
      .trim()
      .toUpperCase();

    if (value === "HIDE_OFFER" || value === "CLOSE_CAMPAIGN") return value;
    return "FEEDBACK";
  }

  function getOfferApplyBehavior(design) {
    var value = String((design && design.offerApplyBehavior) || "SHOW_APPLIED")
      .trim()
      .toUpperCase();

    if (value === "HIDE_OFFER" || value === "CLOSE_CAMPAIGN") return value;
    return "SHOW_APPLIED";
  }

  function getOfferCodeLabel(design) {
    return stringOrDefault(design && design.offerCodeLabel, "Discount code");
  }

  function getCopyCodeLabel(design) {
    return stringOrDefault(design && design.copyCodeLabel, "Copy code");
  }

  function getCopiedCodeLabel(design) {
    return stringOrDefault(design && design.copiedCodeLabel, "Copied");
  }

  function getApplyDiscountLabel(design) {
    return stringOrDefault(
      design && design.applyDiscountLabel,
      "Apply discount",
    );
  }

  function getAppliedDiscountMessage(design) {
    return stringOrDefault(
      design && design.appliedDiscountMessage,
      "Discount applied successfully.",
    );
  }

  function stringOrDefault(value, fallback) {
    var text = typeof value === "string" ? value.trim() : "";

    return text || fallback;
  }

  function buildDiscountApplyUrl(code) {
    return (
      "/discount/" +
      encodeURIComponent(String(code || "")) +
      "?redirect=" +
      encodeURIComponent(getCurrentPath())
    );
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

  function enqueueAnalyticsEvent(root, payload) {
    analyticsEventQueue.push(payload);

    if (analyticsEventQueue.length >= ANALYTICS_MAX_BATCH) {
      flushAnalyticsEvents(root, false);
      return;
    }

    if (analyticsFlushTimer) return;

    analyticsFlushTimer = window.setTimeout(function () {
      flushAnalyticsEvents(root, false);
    }, ANALYTICS_FLUSH_DELAY_MS);
  }

  function flushAnalyticsEvents(root, useBeacon) {
    if (analyticsFlushTimer) {
      window.clearTimeout(analyticsFlushTimer);
      analyticsFlushTimer = null;
    }

    if (!analyticsEventQueue.length) return;

    var events = analyticsEventQueue.splice(0, ANALYTICS_MAX_BATCH);
    var url = getAnalyticsPath(root || getRoot());
    var body = JSON.stringify({ events: events });

    if (useBeacon && navigator && typeof navigator.sendBeacon === "function") {
      try {
        navigator.sendBeacon(
          url,
          new Blob([body], { type: "application/json" }),
        );
        if (analyticsEventQueue.length) flushAnalyticsEvents(root, true);
        return;
      } catch (beaconError) {
        debug(root, beaconError);
      }
    }

    try {
      window
        .fetch(url, {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: body,
        })
        .catch(function () {});
    } catch (error) {
      debug(root, error);
    }

    // Drain anything that exceeded a single batch.
    if (analyticsEventQueue.length) {
      enqueueAnalyticsEvent(root, analyticsEventQueue.shift());
    }
  }

  function installAnalyticsFlushHandlers() {
    if (window.PromoPulseAnalyticsFlushReady) return;
    window.PromoPulseAnalyticsFlushReady = true;

    var flushWithBeacon = function () {
      flushAnalyticsEvents(getRoot(), true);
    };

    window.addEventListener("pagehide", flushWithBeacon);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushWithBeacon();
    });
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

  function rememberBehaviorEvent(eventType, campaign, extra) {
    if (typeof window.PromoPulseRememberBehaviorEvent !== "function") return;

    try {
      window.PromoPulseRememberBehaviorEvent(eventType, campaign, extra || {});
    } catch (error) {
      debug(getRoot(), error);
    }
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

  function safeLocalStorage() {
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
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
    return (campaign && campaign.experimentId) || null;
  }

  function readVariantId(campaign) {
    return (campaign && campaign.variantId) || null;
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
