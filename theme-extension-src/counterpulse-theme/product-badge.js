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
      apiBaseUrl:
        root.dataset.apiBaseUrl || window.CounterPulseApiBaseUrl || "",
    };

    if (!config.shop) {
      updateDebug(root, "Detenido: falta el shop domain en el bloque.");
      return;
    }
    if (!config.productId) {
      updateDebug(
        root,
        "Detenido: Shopify no expuso productId. Coloca el bloque en un contexto de producto.",
      );
      return;
    }
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && !config.campaignId) {
      updateDebug(
        root,
        "Detenido: el modo Specific campaign requiere un Campaign ID.",
      );
      return;
    }

    updateDebug(
      root,
      "Consultando campanas PRODUCT_BADGE elegibles.",
      buildUrl(config),
    );

    fetchCampaign(config)
      .then(function (campaign) {
        if (campaign) {
          updateDebug(root, "API OK: renderizando badge " + campaign.id + ".");
          render(root, campaign);
        } else {
          updateDebug(
            root,
            "API OK: 0 badges elegibles. Revisa tipo PRODUCT_BADGE, placement, status ACTIVE, targeting y fechas.",
          );
        }
      })
      .catch(function (error) {
        updateDebug(root, "Error consultando la API: " + error.message);
        if (config.debug && window.console) console.log("[CP badge]", error);
      });
  }

  function buildUrl(config) {
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

    return getCampaignsEndpoint(config.apiBaseUrl) + "?" + params.toString();
  }

  function getCampaignsEndpoint(apiBaseUrl) {
    var value = String(apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/counterpulse-campaigns";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function fetchCampaign(config) {
    return fetch(buildUrl(config), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(config, payload.settings);
        var campaigns = Array.isArray(payload.campaigns)
          ? payload.campaigns.map(applyExperiment)
          : [];
        return (
          campaigns.filter(function (campaign) {
            return campaign.type === "PRODUCT_BADGE";
          })[0] || null
        );
      });
  }

  function applyExperiment(campaign) {
    if (window.CounterPulseApplyExperiment) {
      return window.CounterPulseApplyExperiment(campaign);
    }

    return campaign;
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

  function updateDebug(root, message, url) {
    var status;
    var endpoint;

    if (!root || root.dataset.debug !== "true") return;

    status = root.querySelector("[data-pp-debug-status]");
    endpoint = root.querySelector("[data-pp-debug-url]");

    if (status) status.textContent = message;
    if (endpoint && url) endpoint.textContent = url;
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
