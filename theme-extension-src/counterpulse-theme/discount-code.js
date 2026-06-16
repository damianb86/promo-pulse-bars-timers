(function () {
  "use strict";

  if (!window.CounterPulseAnalyticsReady) {
    window.CounterPulseAnalyticsReady = true;

    window.CounterPulseTrackEvent = function (eventType, campaign, extra) {
      var root = getRoot();
      var campaignId = campaign && (campaign.id || campaign.campaignId);
      var shop = detectShop(root);
      var payload;

      if (!shop || !campaignId) return;
      if (!analyticsAllowed()) return;

      rememberCampaign(campaign);

      payload = {
        shop: shop,
        campaignId: campaignId,
        eventType: eventType,
        placementType: campaign.placement || campaign.placementType || null,
        sessionId: getSessionId(),
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
            credentials: "omit",
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
        detail: {
          campaignId: campaign.id,
          placement: campaign.placement,
          code: code,
        },
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
    return (
      window.CounterPulseAnalyticsEndpoint ||
      (root && root.dataset.analyticsPath) ||
      "/apps/counterpulse-campaigns"
    );
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

  function getSessionId() {
    var key = "counterpulse_session_id";
    var storage = window.localStorage;
    var value;

    try {
      value = storage.getItem(key);

      if (!value) {
        value =
          (window.crypto &&
            window.crypto.randomUUID &&
            window.crypto.randomUUID()) ||
          String(Date.now()) + Math.random().toString(36).slice(2);
        storage.setItem(key, value);
      }
    } catch {
      value = String(Date.now()) + Math.random().toString(36).slice(2);
    }

    return value;
  }

  function rememberCampaign(campaign) {
    var campaignId = campaign && (campaign.id || campaign.campaignId);
    var placementType =
      campaign && (campaign.placement || campaign.placementType);

    if (!campaignId) return;

    try {
      window.localStorage.setItem(
        "counterpulse_last_seen_campaign",
        JSON.stringify({
          campaignId: campaignId,
          placementType: placementType || null,
          seenAt: Date.now(),
        }),
      );
    } catch (error) {
      debug(getRoot(), error);
    }
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
})();
