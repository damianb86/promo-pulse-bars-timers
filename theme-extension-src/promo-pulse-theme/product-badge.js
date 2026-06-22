(function () {
  "use strict";

  var requestCache = {};

  [].slice.call(document.querySelectorAll(".pp-product-badge")).forEach(init);
  initAutomaticBadges();

  function init(root) {
    if (root.dataset.promoPulseBadgeStarted === "true") return;

    root.dataset.promoPulseBadgeStarted = "true";

    var config = {
      shop: root.dataset.shop || (window.Shopify && window.Shopify.shop) || "",
      locale: root.dataset.locale || document.documentElement.lang || "en",
      country: root.dataset.country || "",
      market: root.dataset.market || detectMarket(),
      currency: root.dataset.cartCurrency || detectCurrency(),
      productId: root.dataset.productId || "",
      device: detectDevice(),
      productTags: split(root.dataset.productTags),
      collectionIds: split(root.dataset.collectionIds),
      vendor: root.dataset.productVendor || "",
      inventoryQuantity: root.dataset.inventoryQuantity || "",
      price: root.dataset.price || "",
      compareAtPrice: root.dataset.compareAtPrice || "",
      discountActive: root.dataset.discountActive || "",
      metafields: root.dataset.metafields || "",
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      placement: root.dataset.placement || "COLLECTION_CARD",
      debug: root.dataset.debug === "true",
      apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };

    if (!config.shop) {
      updateDebug(root, "Detenido: falta el shop domain en el bloque.");
      return;
    }
    if (!config.productId && config.placement !== "COLLECTION_CARD") {
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
      buildBadgesUrl(config),
    );

    fetchBadges(config)
      .then(function (badges) {
        if (badges.length > 0) {
          updateDebug(
            root,
            "API OK: renderizando " + badges.length + " badge(s).",
          );
          renderBadges(root, badges);
        } else {
          return fetchCampaign(config).then(function (campaign) {
            if (campaign) {
              updateDebug(
                root,
                "Fallback simple: renderizando badge " + campaign.id + ".",
              );
              renderBadges(root, [badgeFromCampaign(campaign)]);
            } else {
              updateDebug(
                root,
                "API OK: 0 badges elegibles. Revisa tipo PRODUCT_BADGE, placement, status ACTIVE, targeting, reglas y fechas.",
              );
            }
          });
        }
      })
      .catch(function (error) {
        updateDebug(root, "Error consultando la API: " + error.message);
        if (config.debug && window.console) console.log("[CP badge]", error);
      });
  }

  function buildCommonParams(config) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: window.location.pathname,
      locale: config.locale,
      device: config.device,
      placement: config.placement,
      productId: config.productId,
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.productTags.length)
      params.set("productTags", config.productTags.join(","));
    if (config.collectionIds.length)
      params.set("collectionIds", config.collectionIds.join(","));
    if (config.vendor) params.set("vendor", config.vendor);
    if (config.inventoryQuantity)
      params.set("inventoryQuantity", config.inventoryQuantity);
    if (config.price) params.set("price", config.price);
    if (config.compareAtPrice)
      params.set("compareAtPrice", config.compareAtPrice);
    if (config.discountActive)
      params.set("discountActive", config.discountActive);
    if (config.metafields) params.set("metafields", config.metafields);
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && config.campaignId) {
      params.set("campaignId", config.campaignId);
    }
    appendBehaviorTargetingParams(params);

    return params;
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

  function buildCampaignUrl(config) {
    return (
      getCampaignsEndpoint(config.apiBaseUrl) +
      "?" +
      buildCommonParams(config).toString()
    );
  }

  function buildBadgesUrl(config) {
    return (
      getBadgesEndpoint(config.apiBaseUrl) +
      "?" +
      buildCommonParams(config).toString()
    );
  }

  function getCampaignsEndpoint(apiBaseUrl) {
    var value = String(apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/promo-pulse";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function getBadgesEndpoint(apiBaseUrl) {
    var value = String(apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) {
      return "/apps/promo-pulse/api/storefront/badges";
    }
    if (/\/api\/storefront\/badges$/i.test(value)) return value;

    return value + "/api/storefront/badges";
  }

  function fetchBadges(config) {
    return fetchJson(buildBadgesUrl(config)).then(function (payload) {
      applyStorefrontSettings(config, payload.settings);
      return Array.isArray(payload.badges) ? payload.badges : [];
    });
  }

  function fetchCampaign(config) {
    return fetchJson(buildCampaignUrl(config)).then(function (payload) {
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

  function fetchJson(url) {
    if (!requestCache[url]) {
      requestCache[url] = fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }).then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      });
    }

    return requestCache[url];
  }

  function initAutomaticBadges() {
    var embed = document.getElementById("promo-pulse-app-embed");

    if (!embed || embed.dataset.productBadgeAutoInit === "true") return;

    embed.dataset.productBadgeAutoInit = "true";
    initAutomaticProductPageBadge(embed);
    initAutomaticCollectionBadges(embed);
  }

  function initAutomaticProductPageBadge(embed) {
    var target;

    if (!embed.dataset.productId) return;
    if (
      document.querySelector(
        ".pp-product-badge[data-placement='PRODUCT_PAGE_BADGE']",
      )
    ) {
      return;
    }

    target = findProductPageTarget();
    if (!target) return;

    ensureBadgeMountTarget(target);
    target.appendChild(createAutoSlot(embed, target, "PRODUCT_PAGE_BADGE"));
  }

  function initAutomaticCollectionBadges(embed) {
    findProductCardTargets().forEach(function (card) {
      var target;

      if (card.querySelector(".pp-product-badge")) return;

      target = findBadgeMountTarget(card);
      if (!target) return;

      ensureBadgeMountTarget(target);
      target.appendChild(createAutoSlot(embed, card, "COLLECTION_CARD"));
    });
  }

  function createAutoSlot(embed, source, placement) {
    var slot = document.createElement("div");

    slot.className = "pp-root pp-product-badge pp-product-badge--auto";
    slot.dataset.shop =
      embed.dataset.shop || (window.Shopify && window.Shopify.shop) || "";
    slot.dataset.locale =
      embed.dataset.locale ||
      embed.dataset.defaultLocale ||
      document.documentElement.lang ||
      "en";
    slot.dataset.country = embed.dataset.country || "";
    slot.dataset.market = embed.dataset.market || detectMarket();
    slot.dataset.cartCurrency = embed.dataset.cartCurrency || detectCurrency();
    slot.dataset.productId = readProductId(source, embed);
    slot.dataset.productTags = readDatasetValue(source, "productTags");
    slot.dataset.collectionIds =
      readDatasetValue(source, "collectionIds") ||
      embed.dataset.collectionIds ||
      "";
    slot.dataset.productVendor = readDatasetValue(source, "productVendor");
    slot.dataset.inventoryQuantity = readDatasetValue(
      source,
      "inventoryQuantity",
    );
    slot.dataset.price = readDatasetValue(source, "price");
    slot.dataset.compareAtPrice = readDatasetValue(source, "compareAtPrice");
    slot.dataset.discountActive = readDatasetValue(source, "discountActive");
    slot.dataset.metafields = readDatasetValue(source, "metafields");
    slot.dataset.fallbackMode = "AUTO_ELIGIBLE";
    slot.dataset.placement = placement;
    slot.dataset.apiBaseUrl =
      embed.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "";
    slot.dataset.debug = embed.dataset.debug || "false";

    init(slot);

    return slot;
  }

  function findProductPageTarget() {
    return (
      document.querySelector(
        "[data-product-media], media-gallery, product-gallery, .product__media-wrapper, .product__media, .product-media-container, .product-gallery, .product__media-list",
      ) ||
      document.querySelector(
        "product-info, .product__info-container, .product-form, [data-product-information]",
      )
    );
  }

  function findProductCardTargets() {
    var cards = [];
    var seen = new Set();

    [].slice
      .call(document.querySelectorAll('a[href*="/products/"]'))
      .forEach(function (link) {
        var card = link.closest(
          "[data-product-card], [data-product-id], .card-wrapper, .product-card, .product-grid-item, .grid__item, li",
        );

        if (!card || card.closest(".pp-root") || seen.has(card)) return;

        seen.add(card);
        cards.push(card);
      });

    return cards.slice(0, 48);
  }

  function findBadgeMountTarget(card) {
    var image = card.querySelector("img");
    var target;

    if (!image) return card;

    target = image.closest(
      "[data-product-card-media], .card__media, .product-card__media, .product-card__image-wrapper, .media, .card__inner, a[href*='/products/']",
    );

    if (
      !target ||
      target === document.body ||
      target === document.documentElement
    ) {
      target = image.parentElement || card;
    }

    if (target.tagName === "PICTURE") {
      target = target.parentElement || card;
    }

    return target;
  }

  function ensureBadgeMountTarget(target) {
    var style;

    if (!target || !window.getComputedStyle) return;

    style = window.getComputedStyle(target);
    if (style.position === "static") {
      target.style.position = "relative";
    }
    if (style.display === "inline") {
      target.style.display = "inline-block";
    }
  }

  function readProductId(source, embed) {
    var value =
      readDatasetValue(source, "productId") ||
      readDatasetValue(source, "productGid") ||
      (source === findProductPageTarget() ? embed.dataset.productId || "" : "");

    if (/^\d+$/.test(value)) return "gid://shopify/Product/" + value;

    return value;
  }

  function readDatasetValue(source, key) {
    return source && source.dataset ? source.dataset[key] || "" : "";
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  function badgeFromCampaign(campaign) {
    var badge = campaign.badge || {};
    var texts = campaign.texts || {};

    return {
      id: campaign.id,
      campaignId: campaign.id,
      ruleId: null,
      text:
        badge.badgeText || texts.badgeText || texts.headline || "Limited offer",
      placement: campaign.placement,
      badge: {
        badgeText:
          badge.badgeText ||
          texts.badgeText ||
          texts.headline ||
          "Limited offer",
        badgeShape: badge.badgeShape,
        badgePosition: badge.badgePosition,
        url: "",
      },
      design: campaign.design || {},
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
    };
  }

  function renderBadges(root, badges) {
    var isAutomaticSlot = root.classList.contains("pp-product-badge--auto");
    var renderableBadges = selectRenderableBadges(
      badges,
      isAutomaticSlot ? 1 : 3,
    );

    root.replaceChildren();
    renderableBadges.forEach(function (badge) {
      root.appendChild(renderBadge(badge, isAutomaticSlot));
      emitBadgeImpression(badge);
    });
  }

  function selectRenderableBadges(badges, maxBadges) {
    var seenCampaigns = {};
    var output = [];

    badges.forEach(function (badge) {
      var campaignId = badge.campaignId || badge.id || "";

      if (!campaignId || seenCampaigns[campaignId]) return;
      if (output.length >= maxBadges) return;

      seenCampaigns[campaignId] = true;
      output.push(badge);
    });

    return output;
  }

  function renderBadge(badgePayload, isAutomaticSlot) {
    var badge = badgePayload.badge || {};
    var design = badgePayload.design || {};
    var text = badge.badgeText || badgePayload.text || "Limited offer";
    var href = badge.url || "";
    var element = href
      ? document.createElement("a")
      : document.createElement("span");

    element.className = [
      "pp-badge",
      "pp-badge--" + shape(badge.badgeShape).toLowerCase(),
      "pp-badge--" +
        position(badge.badgePosition).toLowerCase().replace("_", "-"),
    ].join(" ");
    if (!isAutomaticSlot && design.positionMode === "OVERLAY") {
      element.classList.add("pp-surface--overlay");
    }
    element.dataset.campaignId = badgePayload.campaignId || badgePayload.id;
    if (badgePayload.ruleId) element.dataset.badgeRuleId = badgePayload.ruleId;
    element.textContent = text;
    element.setAttribute("role", "note");
    element.setAttribute("aria-label", element.textContent);
    if (href) {
      element.href = href;
      element.addEventListener("click", function () {
        emitBadgeClick(badgePayload);
      });
    }
    setDesign(element, design);

    return element;
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
    element.style.setProperty("--pp-bg", getBackground(design));
    element.style.setProperty("--pp-text", color(design.textColor, "#ffffff"));
    element.style.setProperty(
      "--pp-accent",
      color(design.accentColor, "#22c55e"),
    );
    element.style.setProperty(
      "--pp-border-size",
      clamp(design.borderSize, 0, 8, 1) + "px",
    );
    element.style.setProperty(
      "--pp-border-color",
      color(design.borderColor, color(design.accentColor, "#22c55e")),
    );
    element.style.setProperty(
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 13) + "px",
    );
    element.style.setProperty(
      "--pp-font-family",
      fontFamily(design.fontFamily),
    );
    element.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 999, 999) + "px",
    );
    element.style.setProperty(
      "--pp-padding-block",
      clamp(design.paddingBlock, 4, 48, 6) + "px",
    );
    element.style.setProperty(
      "--pp-padding-inline",
      clamp(design.paddingInline, 8, 64, 9) + "px",
    );
  }

  function fontFamily(value) {
    if (value === "SERIF") return "Georgia, Times New Roman, serif";
    if (value === "MONO")
      return "ui-monospace, SFMono-Regular, Menlo, monospace";
    if (value === "ROUNDED") {
      return "ui-rounded, Arial Rounded MT Bold, system-ui, sans-serif";
    }
    if (value === "GEOMETRIC")
      return "Avenir Next, Montserrat, system-ui, sans-serif";
    if (value === "HUMANIST") return "Optima, Gill Sans, system-ui, sans-serif";
    if (value === "CONDENSED")
      return "Arial Narrow, Roboto Condensed, system-ui, sans-serif";
    if (value === "CASUAL")
      return "Trebuchet MS, Comic Sans MS, system-ui, sans-serif";
    if (value === "SYSTEM") {
      return "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    }

    return "inherit";
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

  function emitBadgeImpression(badge) {
    document.dispatchEvent(
      new CustomEvent("promo-pulse:badge-impression", {
        detail: {
          campaignId: badge.campaignId || badge.id,
          badgeRuleId: badge.ruleId || null,
          placement: badge.placement,
        },
      }),
    );
  }

  function emitBadgeClick(badge) {
    document.dispatchEvent(
      new CustomEvent("promo-pulse:badge-click", {
        detail: {
          campaignId: badge.campaignId || badge.id,
          badgeRuleId: badge.ruleId || null,
          placement: badge.placement,
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
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
    config.currency = config.currency || settings.defaultCurrency || "";
  }
})();
