(function () {
  "use strict";

  var blocks = [].slice.call(document.querySelectorAll(".pp-product-timer"));

  blocks.forEach(init);

  function init(root) {
    var config = {
      shop: root.dataset.shop || (window.Shopify && window.Shopify.shop) || "",
      locale: root.dataset.locale || document.documentElement.lang || "en",
      country: root.dataset.country || "",
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
    };

    if (!config.shop || !config.productId) return;
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && !config.campaignId)
      return;

    fetchCampaign(config)
      .then(function (campaign) {
        if (!campaign) return;
        render(root, campaign, config);
        bindVariantChanges(root, campaign, config);
      })
      .catch(function (error) {
        if (config.debug && window.console) console.log("[CP stock]", error);
      });
  }

  function fetchCampaign(config) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: window.location.pathname,
      locale: config.locale,
      placement: "PRODUCT_PAGE",
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
            return campaign.type === "LOW_STOCK";
          })[0] || null
        );
      });
  }

  function render(root, campaign, config) {
    var message = buildMessage(campaign.lowStock, currentInventory(config), [
      (campaign.texts || {}).lowStockText,
      (campaign.lowStock || {}).fallbackMessage,
    ]);
    var card;
    var design = campaign.design || {};

    if (!message) {
      root.replaceChildren();
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

    if (
      config.showIcon &&
      design.showIcon !== false &&
      design.icon !== "NONE"
    ) {
      card.appendChild(node("span", "pp-icon", iconLabel(design.icon)));
    }

    card.appendChild(renderMessage(campaign, message));
    root.replaceChildren(card);
    emitImpression(campaign);
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
      clamp(design.fontSize, 10, 24, 14) + "px",
    );
    element.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 24, 4) + "px",
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
      new CustomEvent("counterpulse:impression", {
        detail: { campaignId: campaign.id, placement: campaign.placement },
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

  function iconLabel(icon) {
    return (
      { FIRE: "Sale", CLOCK: "Time", TRUCK: "Ship", GIFT: "Gift", TAG: "Deal" }[
        icon
      ] || ""
    );
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

  function applyStorefrontSettings(config, settings) {
    if (!settings || typeof settings !== "object") return;

    window.CounterPulseSettings = settings;
    config.debug = settings.enableDebugMode === true || config.debug;
    config.customProductFormSelector =
      settings.customProductFormSelector || config.customProductFormSelector;
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }

  function safeQuerySelector(selector) {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch {
      return null;
    }
  }
})();
