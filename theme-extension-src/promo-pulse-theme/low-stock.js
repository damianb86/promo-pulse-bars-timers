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
      device: detectDevice(),
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      alignment: root.dataset.alignment || "CENTER",
      compactMode: root.dataset.compact === "true",
      debug: root.dataset.debug === "true",
      selectedVariantId: normalizeVariantId(root.dataset.selectedVariantId),
      inventoryQuantity: numberOrNull(root.dataset.inventoryQuantity),
      variants: readVariants(root.dataset.variantsScriptId),
      customProductFormSelector: root.dataset.customProductFormSelector || "",
      apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
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

    fetchCampaigns(config)
      .then(function (campaigns) {
        if (!campaigns.length) {
          updateDebug(
            root,
            "API OK: 0 campanas LOW_STOCK elegibles para PRODUCT_PAGE.",
            requestUrl,
          );
          getRenderSlot(root, "low-stock").replaceChildren();
          return;
        }
        updateDebug(
          root,
          "API OK: " + campaigns.length + " campana(s) LOW_STOCK recibidas.",
        );
        renderAll(root, campaigns, config);
        bindVariantChanges(root, campaigns, config);
      })
      .catch(function (error) {
        updateDebug(root, "Error LOW_STOCK: " + error.message, requestUrl);
        if (config.debug && window.console) console.log("[CP stock]", error);
      });
  }

  // Shared per-asset render slot inside the .pp-product-timer block so the
  // timer, low-stock and delivery-cutoff assets never clobber each other.
  function getRenderSlot(root, name) {
    var slot = root.querySelector('[data-pp-slot="' + name + '"]');
    if (!slot) {
      slot = document.createElement("div");
      slot.setAttribute("data-pp-slot", name);
      slot.className = "pp-render-slot pp-render-slot--" + name;
      root.appendChild(slot);
    }
    return slot;
  }

  function renderAll(root, campaigns, config) {
    var slot = getRenderSlot(root, "low-stock");
    var entries = [];

    campaigns.forEach(function (campaign) {
      var card = buildLowStockCard(root, campaign, config);
      if (card) entries.push({ card: card, campaign: campaign });
    });

    slot.replaceChildren.apply(
      slot,
      entries.map(function (entry) {
        return entry.card;
      }),
    );

    entries.forEach(function (entry) {
      startTimerTick(entry.card, entry.campaign);
      emitImpression(entry.campaign);
    });
  }

  function buildUrl(config) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: window.location.pathname,
      locale: config.locale,
      device: config.device,
      placement: "PRODUCT_PAGE",
      productId: config.productId,
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.productTags.length)
      params.set("productTags", config.productTags.join(","));
    if (config.selectedVariantId) {
      params.set("selectedVariantId", config.selectedVariantId);
    }
    var inventoryQuantity = currentInventory(config);
    if (inventoryQuantity !== null) {
      params.set("inventoryQuantity", String(inventoryQuantity));
    }
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

  function onlyLowStock(payload, config) {
    applyStorefrontSettings(config, payload.settings);
    var campaigns = Array.isArray(payload.campaigns)
      ? payload.campaigns.map(applyExperiment)
      : [];
    return campaigns.filter(function (campaign) {
      return campaign.type === "LOW_STOCK";
    });
  }

  function fetchCampaigns(config) {
    var campaignId =
      config.fallbackMode === "SPECIFIC_CAMPAIGN" ? config.campaignId : "";

    if (window.PromoPulseFetchCampaigns) {
      return window
        .PromoPulseFetchCampaigns(config, "PRODUCT_PAGE", {
          campaignId: campaignId,
        })
        .then(function (payload) {
          return onlyLowStock(payload, config);
        });
    }

    return fetch(buildUrl(config), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (payload) {
        return onlyLowStock(payload, config);
      });
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  function buildLowStockCard(root, campaign, config) {
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
      return null;
    }

    if (!window.CountPulseSurface) {
      updateDebug(root, "Surface module no disponible todavia.");
      return null;
    }

    var texts = campaign.texts || {};
    var timerState = window.CountPulseSurface.computeTimerState(campaign);
    var hasTimer = Boolean(timerState && timerState.isActive);

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

    var inventory = currentInventory(config);
    var lowStockVariables = {};
    if (
      (campaign.lowStock || {}).showExactQuantity &&
      typeof inventory === "number"
    ) {
      lowStockVariables.quantity = String(Math.floor(inventory));
    }

    card = window.CountPulseSurface.build({
      tracking: {
        campaignId: campaign.id,
        experimentId: campaign.experimentId || null,
        variantId: campaign.variantId || null,
        placement: campaign.placement,
      },
      variant: "block",
      placement: campaign.placement || "PRODUCT_PAGE",
      design: design,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: config.locale,
      variables: lowStockVariables,
      headline: message,
      body: null,
      timer: {
        isActive: hasTimer,
        isExpired: Boolean(timerState && timerState.isExpired),
        remainingMs: timerState ? timerState.remainingMs : 0,
      },
      hasTimer: hasTimer,
      couponNode: couponNode,
      cta:
        !timerState.isExpired && design.showButton !== false
          ? texts.ctaText || ""
          : "",
      ctaUrl: texts.ctaUrl || "",
      dataTestId: "low-stock-widget",
      onClose: function () {
        card.remove();
      },
    });
    card.dataset.campaignId = campaign.id;
    card.setAttribute("role", "status");
    if (config.compactMode) {
      card.classList.add("counterpulse-preview-promo--compact");
    }

    return card;
  }

  function startTimerTick(card, campaign) {
    var countdown = card.querySelector("[data-cp-timer]");
    if (!countdown || !window.CountPulseSurface) {
      return;
    }

    var id = window.setInterval(function () {
      if (!card.isConnected) {
        window.clearInterval(id);
        return;
      }

      var timerState = window.CountPulseSurface.computeTimerState(campaign);
      // On expiry just drop the countdown; the low-stock message itself stays.
      if (!timerState || timerState.isExpired) {
        window.clearInterval(id);
        countdown.remove();
        return;
      }

      window.CountPulseSurface.updateTimer(
        countdown,
        timerState.remainingMs,
        campaign.design || {},
      );
    }, 1000);
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

  function bindVariantChanges(root, campaigns, config) {
    var form =
      safeQuerySelector(config.customProductFormSelector) ||
      root.closest("form[action*='/cart/add']") ||
      document.querySelector("form[action*='/cart/add']");

    // Re-evaluates the currently selected variant from every signal a theme
    // might use, and re-renders only when it actually changed. Low-stock copy
    // shows/hides based on the new variant's inventory.
    function syncSelectedVariant(nextId) {
      var resolved = normalizeVariantId(nextId || getSelectedVariantId(form));
      if (!resolved || resolved === config.selectedVariantId) return;
      config.selectedVariantId = resolved;
      renderAll(root, campaigns, config);
    }

    // 1) Direct form controls (radios, selects, hidden id input).
    if (form) {
      ["change", "input"].forEach(function (eventName) {
        form.addEventListener(eventName, function () {
          syncSelectedVariant();
        });
      });
    }

    // 2) Theme variant-change custom events (Dawn and most modern themes).
    ["variant:change", "on:variant:change", "variantChange"].forEach(
      function (eventName) {
        document.addEventListener(eventName, function (event) {
          var detail = event && event.detail;
          var variant = detail && (detail.variant || detail.selectedVariant);
          syncSelectedVariant(variant && (variant.id || variant.variantId));
        });
      },
    );

    // 3) URL-driven selection (?variant=) for themes that update history.
    window.addEventListener("popstate", function () {
      syncSelectedVariant();
    });

    // 4) Polling fallback catches programmatic updates that fire no event.
    window.setInterval(function () {
      if (!root.isConnected) return;
      syncSelectedVariant();
    }, 700);
  }

  function getSelectedVariantId(form) {
    // The ?variant= URL param is the source of truth once a shopper selects a
    // variant in most themes; fall back to the cart form's id field.
    try {
      var fromUrl = new URLSearchParams(window.location.search).get("variant");
      if (fromUrl) return fromUrl;
    } catch {
      /* URL not parseable */
    }
    return form ? readVariantId(form) : "";
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
