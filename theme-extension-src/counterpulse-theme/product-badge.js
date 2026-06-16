(function () {
  "use strict";

  [].slice.call(document.querySelectorAll(".pp-product-badge")).forEach(init);

  function init(root) {
    var config = {
      shop: root.dataset.shop || (window.Shopify && window.Shopify.shop) || "",
      locale: root.dataset.locale || document.documentElement.lang || "en",
      country: root.dataset.country || "",
      productId: root.dataset.productId || "",
      productTags: split(root.dataset.productTags),
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      placement: root.dataset.placement || "COLLECTION_CARD",
      debug: root.dataset.debug === "true",
    };

    if (!config.shop || !config.productId) return;
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && !config.campaignId)
      return;

    fetchCampaign(config)
      .then(function (campaign) {
        if (campaign) render(root, campaign);
      })
      .catch(function (error) {
        if (config.debug && window.console) console.log("[CP badge]", error);
      });
  }

  function fetchCampaign(config) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: window.location.pathname,
      locale: config.locale,
      placement: config.placement,
      productId: config.productId,
    });

    if (config.country) params.set("country", config.country);
    if (config.productTags.length)
      params.set("productTags", config.productTags.join(","));
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && config.campaignId) {
      params.set("campaignId", config.campaignId);
    }

    return fetch("/apps/counterpulse-campaigns?" + params.toString(), {
      credentials: "omit",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(config, payload.settings);
        var campaigns = Array.isArray(payload.campaigns)
          ? payload.campaigns
          : [];
        return (
          campaigns.filter(function (campaign) {
            return campaign.type === "PRODUCT_BADGE";
          })[0] || null
        );
      });
  }

  function render(root, campaign) {
    var badge = campaign.badge || {};
    var texts = campaign.texts || {};
    var element = document.createElement("span");

    element.className = [
      "pp-badge",
      "pp-badge--" + shape(badge.badgeShape).toLowerCase(),
      "pp-badge--" +
        position(badge.badgePosition).toLowerCase().replace("_", "-"),
    ].join(" ");
    element.dataset.campaignId = campaign.id;
    element.textContent =
      badge.badgeText || texts.badgeText || texts.headline || "Limited offer";
    element.setAttribute("role", "note");
    element.setAttribute("aria-label", element.textContent);
    setDesign(element, campaign.design || {});
    root.replaceChildren(element);
    emitImpression(campaign);
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
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 13) + "px",
    );
  }

  function shape(value) {
    return value === "ROUNDED" || value === "SQUARE" ? value : "PILL";
  }

  function position(value) {
    return value === "TOP_LEFT" ||
      value === "BOTTOM_LEFT" ||
      value === "BOTTOM_RIGHT"
      ? value
      : "TOP_RIGHT";
  }

  function emitImpression(campaign) {
    document.dispatchEvent(
      new CustomEvent("counterpulse:impression", {
        detail: { campaignId: campaign.id, placement: campaign.placement },
      }),
    );
  }

  function split(value) {
    return (value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
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

  function applyStorefrontSettings(config, settings) {
    if (!settings || typeof settings !== "object") return;

    window.CounterPulseSettings = settings;
    config.debug = settings.enableDebugMode === true || config.debug;
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
