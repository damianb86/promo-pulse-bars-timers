(function () {
  "use strict";

  var blocks = [].slice.call(document.querySelectorAll(".pp-product-timer"));

  blocks.forEach(init);

  function init(root) {
    var config = {
      shop: root.dataset.shop || (window.Shopify && window.Shopify.shop) || "",
      locale: root.dataset.locale || document.documentElement.lang || "en",
      country: root.dataset.country || "",
      market: root.dataset.market || detectMarket(),
      currency: root.dataset.cartCurrency || detectCurrency(),
      productId: root.dataset.productId || "",
      productTags: split(root.dataset.productTags),
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      alignment: root.dataset.alignment || "CENTER",
      compactMode: root.dataset.compact === "true",
      showIcon: root.dataset.showIcon !== "false",
      debug: root.dataset.debug === "true",
      selectedVariantId: normalizeVariantId(root.dataset.selectedVariantId),
      inventoryQuantity: numberOrNull(root.dataset.inventoryQuantity),
      variants: readVariants(root.dataset.variantsScriptId),
      customProductFormSelector: root.dataset.customProductFormSelector || "",
      apiBaseUrl:
        root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };
    var requestUrl;

    if (!config.shop) {
      updateDebug(root, "Low stock detenido: falta el shop domain.");
      return;
    }
    if (!config.productId) {
      updateDebug(
        root,
        "Low stock detenido: Shopify no expuso productId en este contexto.",
      );
      return;
    }
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && !config.campaignId) {
      updateDebug(
        root,
        "Low stock detenido: Specific campaign requiere un Campaign ID.",
      );
      return;
    }

    requestUrl = buildUrl(config);
    updateDebug(root, "Consultando campanas LOW_STOCK.", requestUrl);

    fetchCampaign(config)
      .then(function (campaign) {
        if (!campaign) {
          updateDebug(
            root,
            "API OK: 0 campanas LOW_STOCK elegibles para PRODUCT_PAGE.",
            requestUrl,
          );
          return;
        }
        updateDebug(
          root,
          "API OK: campana LOW_STOCK recibida " + campaign.id + ".",
        );
        render(root, campaign, config);
        bindVariantChanges(root, campaign, config);
      })
      .catch(function (error) {
        updateDebug(root, "Error LOW_STOCK: " + error.message, requestUrl);
        if (config.debug && window.console) console.log("[CP stock]", error);
      });
  }

  function buildUrl(config) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: window.location.pathname,
      locale: config.locale,
      placement: "PRODUCT_PAGE",
      productId: config.productId,
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.productTags.length)
      params.set("productTags", config.productTags.join(","));
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
            return campaign.type === "LOW_STOCK";
          })[0] || null
        );
      });
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  function render(root, campaign, config) {
    var message = buildMessage(campaign.lowStock, currentInventory(config), [
      (campaign.texts || {}).lowStockText,
      (campaign.lowStock || {}).fallbackMessage,
    ]);
    var card;
    var design = campaign.design || {};

    if (!message) {
      updateDebug(
        root,
        "Campana LOW_STOCK recibida, pero no se muestra: no hay inventario real bajo el threshold ni fallback configurado.",
      );
      if (!config.debug) root.replaceChildren();
      return;
    }

    card = document.createElement("section");
    card.className =
      "pp-product-card pp-low-stock" +
      (config.compactMode ? " pp-product-card--compact" : "");
    card.dataset.campaignId = campaign.id;
    card.setAttribute("role", "status");
    card.setAttribute(
      "aria-label",
      ((campaign.texts || {}).headline || "Low stock").trim(),
    );
    setDesign(card, design, config.alignment);

    if (config.showIcon) {
      var icon = renderDesignIcon(design);
      if (icon) card.appendChild(icon);
    }

    card.appendChild(renderMessage(campaign, message));
    root.replaceChildren(card);
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

  function renderMessage(campaign, detail) {
    var texts = campaign.texts || {};
    var wrapper = document.createElement("div");
    wrapper.className = "pp-message";
    wrapper.appendChild(node("strong", "", texts.headline || "Low stock"));
    wrapper.appendChild(node("span", "", detail));
    return wrapper;
  }

  function bindVariantChanges(root, campaign, config) {
    var form =
      safeQuerySelector(config.customProductFormSelector) ||
      root.closest("form[action*='/cart/add']") ||
      document.querySelector("form[action*='/cart/add']");
    var controls;

    if (!form) return;

    controls = [].slice.call(form.querySelectorAll("[name='id']"));
    if (!controls.length) return;

    controls.forEach(function (control) {
      control.addEventListener("change", function () {
        config.selectedVariantId = normalizeVariantId(readVariantId(form));
        render(root, campaign, config);
      });
    });
  }

  function currentInventory(config) {
    var selectedId = normalizeVariantId(config.selectedVariantId);
    var variant = selectedId ? config.variants[selectedId] : null;

    if (variant && variant.inventoryQuantity !== null) {
      return variant.inventoryQuantity;
    }

    return config.inventoryQuantity;
  }

  function buildMessage(settings, inventoryQuantity, templates) {
    settings = settings || {};
    var fallback = trim(settings.fallbackMessage || templates[1] || "");
    var quantity = numberOrNull(inventoryQuantity);
    var threshold = numberOrNull(settings.threshold);
    var template = trim(templates[0] || "");

    if (quantity === null) return fallback || null;
    quantity = Math.floor(quantity);
    threshold = threshold === null ? 5 : Math.floor(threshold);

    if (quantity <= 0) return fallback || null;
    if (quantity > threshold) return null;

    if (settings.showExactQuantity) {
      return (template || "Only {{quantity}} left in stock.").replace(
        /\{\{\s*(quantity|count)\s*\}\}/g,
        String(quantity),
      );
    }

    if (fallback) return fallback;
    if (template && !/\{\{\s*(quantity|count)\s*\}\}/.test(template))
      return template;
    return "Low stock";
  }

  function readVariants(scriptId) {
    var script = scriptId ? document.getElementById(scriptId) : null;
    var variants = {};

    if (!script) return variants;

    try {
      JSON.parse(script.textContent || "[]").forEach(function (variant) {
        var id = normalizeVariantId(variant.id || variant.legacyId);
        if (!id) return;
        variants[id] = {
          inventoryQuantity: numberOrNull(variant.inventoryQuantity),
        };
      });
    } catch {
      return variants;
    }

    return variants;
  }

  function readVariantId(form) {
    var checked = form.querySelector("[name='id']:checked");
    var field = checked || form.querySelector("[name='id']");
    return field ? field.value : "";
  }

  function setDesign(element, design, alignment) {
    element.style.setProperty("--pp-bg", getBackground(design));
    element.style.setProperty("--pp-text", color(design.textColor, "#ffffff"));
    element.style.setProperty(
      "--pp-accent",
      color(design.accentColor, "#22c55e"),
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
      textAlign(alignment || design.alignment),
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

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function split(value) {
    return (value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function normalizeVariantId(value) {
    if (!value) return "";
    value = String(value);
    return value.indexOf("gid://") === 0
      ? value
      : "gid://shopify/ProductVariant/" + value;
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function trim(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function renderDesignIcon(design) {
    var icon = document.createElement("span");
    var image;
    var svg;

    if (!design || design.showIcon === false) return null;

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

    svg = getIconSvg(design.icon);
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

  function color(value, fallback) {
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
        color(design.gradientStartColor, "#252237") +
        ", " +
        color(design.gradientEndColor, "#4c4861") +
        ")"
      );
    }

    return color(design.backgroundColor, "#111827");
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

  function textAlign(value) {
    if (value === "LEFT") return "left";
    if (value === "RIGHT") return "right";
    return "center";
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

  function applyStorefrontSettings(config, settings) {
    if (!settings || typeof settings !== "object") return;

    window.PromoPulseSettings = settings;
    config.debug = settings.enableDebugMode === true || config.debug;
    config.customProductFormSelector =
      settings.customProductFormSelector || config.customProductFormSelector;
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
    config.currency = config.currency || settings.defaultCurrency || "";
  }

  function safeQuerySelector(selector) {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch {
      return null;
    }
  }
})();
