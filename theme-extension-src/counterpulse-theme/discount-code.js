(function () {
  "use strict";

  var visitorIdStorageKey = "counterpulse_visitor_id";
  var sessionIdStorageKey = "counterpulse_session_id";
  var attributionStorageKey = "counterpulse_last_seen_campaign";
  var lastSeenCampaignIdStorageKey = "counterpulse_last_seen_campaign_id";
  var lastSeenExperimentIdStorageKey = "counterpulse_last_seen_experiment_id";
  var lastSeenVariantIdStorageKey = "counterpulse_last_seen_variant_id";
  var lastPromoTouchStorageKey = "counterpulse_last_promo_touch";
  var memoryVisitorId = "";
  var memorySessionId = "";

  installFetchGuard();

  if (!window.CounterPulseAnalyticsReady) {
    window.CounterPulseAnalyticsReady = true;

    window.CounterPulseTrackEvent = function (eventType, campaign, extra) {
      var root = getRoot();
      var campaignId = campaign && (campaign.id || campaign.campaignId);
      var shop = detectShop(root);
      var tracking;
      var payload;

      if (!shop || !campaignId) return;
      if (!analyticsAllowed()) return;
      if (isPaused("CounterPulseProxyPausedUntil")) return;

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

    window.CounterPulseTrackCopy = function (campaign) {
      window.CounterPulseTrackEvent("COPY_CODE", campaign);
    };

    document.addEventListener("counterpulse:impression", function (event) {
      window.CounterPulseTrackEvent("IMPRESSION", event.detail || {});
    });

    document.addEventListener("counterpulse:click", function (event) {
      window.CounterPulseTrackEvent("CLICK", event.detail || {});
    });

    document.addEventListener("counterpulse:copy-code", function (event) {
      window.CounterPulseTrackEvent("COPY_CODE", event.detail || {});
    });
  }

  window.CounterPulseCopyCode = function (code, campaign) {
    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(code).catch(function () {});
    }

    document.dispatchEvent(
      new CustomEvent("counterpulse:copy-code", {
        detail: Object.assign(buildCampaignTrackingDetail(campaign), {
          code: code,
        }),
      }),
    );
  };

  window.CPcb = window.CounterPulseCouponButton = function (code, campaign) {
    var button = document.createElement("button");
    button.className = "pp-code";
    button.type = "button";
    button.textContent = code;
    button.onclick = function () {
      window.CounterPulseCopyCode(code, campaign);
    };
    return button;
  };

  function getRoot() {
    return (
      document.getElementById("counterpulse-app-embed") ||
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
      window.CounterPulseAnalyticsEndpoint ||
      (root && root.dataset.analyticsPath) ||
      "/apps/counterpulse-campaigns"
    );
  }

  function getApiBaseUrl(root) {
    var value =
      window.CounterPulseApiBaseUrl || (root && root.dataset.apiBaseUrl) || "";

    value = String(value).trim().replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "";

    return value;
  }

  function analyticsAllowed() {
    var settings = window.CounterPulseSettings || {};

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

  function getVisitorSessionTracking(campaign) {
    var touchTime = Date.now();

    return {
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
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
    var storage = window[storageName];
    var value;

    try {
      if (!storage) return "";
      value = storage.getItem(key);
    } catch {
      value = "";
    }

    return typeof value === "string" ? value : "";
  }

  function writeStoredValue(storageName, key, value) {
    var storage = window[storageName];

    try {
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
        (window.CounterPulseSettings || {}).enableDebugMode === true) &&
      window.console
    ) {
      window.console.log("[CounterPulse analytics]", error);
    }
  }

  function installFetchGuard() {
    if (window.CounterPulseFetchGuardReady || !window.fetch) return;

    var nativeFetch = window.fetch.bind(window);
    var pending = {};
    var proxyPauseMs = 60000;
    var cartPauseMs = 30000;

    window.CounterPulseFetchGuardReady = true;

    window.fetch = function (input, init) {
      var request = normalizeRequest(input, init);
      var pauseKey = pauseKeyFor(request.url);
      var cacheKey;

      if (!request.watch) {
        return nativeFetch(input, init);
      }

      if (pauseKey && isPaused(pauseKey)) {
        return Promise.resolve(syntheticResponse(request));
      }

      cacheKey = request.method + ":" + request.url;

      if (request.method === "GET" && pending[cacheKey]) {
        return pending[cacheKey].then(function (response) {
          return response.clone();
        });
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
    var isProxy = path === "/apps/counterpulse-campaigns";
    var isCart = path === "/cart.js";

    return {
      kind: isCart ? "cart" : "proxy",
      method: String(method).toUpperCase(),
      url: url.toString(),
      watch: isProxy || isCart,
    };
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

  function pauseKeyFor(url) {
    var pathname = new URL(url, window.location.href).pathname;

    if (pathname === "/cart.js") return "CounterPulseCartPausedUntil";
    if (pathname === "/apps/counterpulse-campaigns") {
      return "CounterPulseProxyPausedUntil";
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
          typeof window.CounterPulseCartSubtotal === "number"
            ? Math.round(window.CounterPulseCartSubtotal * 100)
            : 0,
        currency: window.CounterPulseCartCurrency || "USD",
        token: "",
      });
    } else if (request.method === "POST") {
      body = JSON.stringify({
        ok: false,
        saved: false,
        ignored: true,
        reason: "storefront_proxy_paused",
      });
    } else {
      body = JSON.stringify({
        campaigns: [],
        settings: window.CounterPulseSettings || null,
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
