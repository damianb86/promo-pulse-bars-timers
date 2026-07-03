(function () {
  "use strict";

  var requestCache = (window.PromoPulseBadgeRequestCache =
    window.PromoPulseBadgeRequestCache || {});
  var pendingRequests = (window.PromoPulseBadgePendingRequests =
    window.PromoPulseBadgePendingRequests || {});
  var collectionBadgeBatchQueue = [];
  var collectionBadgeBatchTimer = null;
  var collectionBadgeBatchSequence = 0;
  var badgeEligibilityCache = {};
  var badgeEligibilityPendingRequests = {};
  var badgeRequestTtlMs = 300000;

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
      selectedVariantId: normalizeVariantId(root.dataset.selectedVariantId),
      inventoryQuantity: root.dataset.inventoryQuantity || "",
      price: root.dataset.price || "",
      compareAtPrice: root.dataset.compareAtPrice || "",
      discountActive: root.dataset.discountActive || "",
      metafields: root.dataset.metafields || "",
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      placement: root.dataset.placement || "COLLECTION_CARD",
      customProductPageBadgeSelector:
        root.dataset.customProductPageBadgeSelector || "",
      customCollectionCardSelector:
        root.dataset.customCollectionCardSelector || "",
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
          updateDebug(
            root,
            "API OK: 0 badges elegibles. Revisa tipo PRODUCT_BADGE, placement, status ACTIVE, targeting, reglas y fechas.",
          );
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
    if (config.selectedVariantId) {
      params.set("selectedVariantId", config.selectedVariantId);
    }
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
  }

  function buildBadgesUrl(config) {
    return (
      getBadgesEndpoint(config.apiBaseUrl) +
      "?" +
      buildCommonParams(config).toString()
    );
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
    return hasConfiguredBadgeCampaigns(config).then(function (hasBadges) {
      if (!hasBadges) return [];

      if (shouldBatchCollectionBadgeRequest(config)) {
        return fetchCollectionBadgeBatch(config);
      }

      return fetchJson(buildBadgesUrl(config)).then(function (payload) {
        applyStorefrontSettings(config, payload.settings);
        return Array.isArray(payload.badges) ? payload.badges : [];
      });
    });
  }

  function hasConfiguredBadgeCampaigns(config) {
    var eligibilityConfig;
    var eligibilityKey;

    if (typeof window.PromoPulseFetchCampaigns !== "function") {
      return Promise.resolve(false);
    }

    eligibilityConfig = buildBadgeEligibilityConfig(config);
    eligibilityKey = buildBadgeEligibilityKey(eligibilityConfig);

    if (
      Object.prototype.hasOwnProperty.call(
        badgeEligibilityCache,
        eligibilityKey,
      )
    ) {
      return Promise.resolve(badgeEligibilityCache[eligibilityKey]);
    }

    if (badgeEligibilityPendingRequests[eligibilityKey]) {
      return badgeEligibilityPendingRequests[eligibilityKey];
    }

    badgeEligibilityPendingRequests[eligibilityKey] = window
      .PromoPulseFetchCampaigns(eligibilityConfig, "", {})
      .then(function (payload) {
        applyStorefrontSettings(config, payload.settings);
        badgeEligibilityCache[eligibilityKey] = payload.badgesEnabled === true;
        return badgeEligibilityCache[eligibilityKey];
      })
      .catch(function () {
        badgeEligibilityCache[eligibilityKey] = false;
        return false;
      })
      .finally(function () {
        delete badgeEligibilityPendingRequests[eligibilityKey];
      });

    return badgeEligibilityPendingRequests[eligibilityKey];
  }

  function buildBadgeEligibilityConfig(config) {
    return {
      shop: config.shop,
      locale: config.locale,
      country: config.country,
      market: config.market,
      currency: config.currency,
      device: config.device,
      apiBaseUrl: config.apiBaseUrl,
    };
  }

  function buildBadgeEligibilityKey(config) {
    return [
      config.shop || "",
      window.location.pathname || "/",
      config.locale || "",
      config.country || "",
      config.market || "",
      config.currency || "",
      config.device || "",
      config.apiBaseUrl || "",
    ].join("|");
  }

  function shouldBatchCollectionBadgeRequest(config) {
    return (
      config.placement === "COLLECTION_CARD" &&
      config.fallbackMode !== "SPECIFIC_CAMPAIGN"
    );
  }

  function fetchCollectionBadgeBatch(config) {
    return new Promise(function (resolve, reject) {
      collectionBadgeBatchSequence += 1;
      config.__badgeBatchKey =
        "collection-card-" + collectionBadgeBatchSequence;
      collectionBadgeBatchQueue.push({
        config: config,
        reject: reject,
        resolve: resolve,
      });

      if (collectionBadgeBatchTimer) return;

      collectionBadgeBatchTimer = window.setTimeout(
        flushCollectionBadgeBatch,
        0,
      );
    });
  }

  function flushCollectionBadgeBatch() {
    var batch = collectionBadgeBatchQueue.slice();

    collectionBadgeBatchQueue = [];
    collectionBadgeBatchTimer = null;

    if (!batch.length) return;

    fetchJson(
      buildBatchBadgesUrl(
        batch.map(function (item) {
          return item.config;
        }),
      ),
    )
      .then(function (payload) {
        var badgesByKey = {};

        applyStorefrontSettings(batch[0].config, payload.settings);
        (Array.isArray(payload.badgeGroups) ? payload.badgeGroups : []).forEach(
          function (group) {
            if (!group || !group.key) return;

            badgesByKey[group.key] = Array.isArray(group.badges)
              ? group.badges
              : [];
          },
        );
        batch.forEach(function (item) {
          item.resolve(badgesByKey[item.config.__badgeBatchKey] || []);
        });
      })
      .catch(function (error) {
        batch.forEach(function (item) {
          item.reject(error);
        });
      });
  }

  function buildBatchBadgesUrl(configs) {
    var config = configs[0];
    var params = buildCommonParams(config);

    [
      "productId",
      "productTags",
      "collectionIds",
      "vendor",
      "selectedVariantId",
      "inventoryQuantity",
      "price",
      "compareAtPrice",
      "discountActive",
      "metafields",
      "campaignId",
    ].forEach(function (key) {
      params.delete(key);
    });
    params.set(
      "badgeContexts",
      JSON.stringify(configs.map(buildBatchBadgeContext)),
    );

    return getBadgesEndpoint(config.apiBaseUrl) + "?" + params.toString();
  }

  function buildBatchBadgeContext(config) {
    return compactContext({
      key: config.__badgeBatchKey,
      productId: config.productId,
      productTags: config.productTags,
      collectionIds: config.collectionIds,
      vendor: config.vendor,
      selectedVariantId: config.selectedVariantId,
      inventoryQuantity: config.inventoryQuantity,
      price: config.price,
      compareAtPrice: config.compareAtPrice,
      discountActive: config.discountActive,
      metafields: config.metafields,
    });
  }

  function compactContext(context) {
    var output = {};

    Object.keys(context).forEach(function (key) {
      var value = context[key];

      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value) && value.length === 0) return;

      output[key] = value;
    });

    return output;
  }

  function fetchJson(url) {
    var cached = requestCache[url];
    var stored = readStoredBadgePayload(url);
    var headers = { Accept: "application/json" };
    var now = Date.now();

    if (cached && cached.expiresAt > now) {
      return Promise.resolve(clonePayload(cached.payload));
    }

    if (stored && stored.expiresAt > now) {
      requestCache[url] = {
        expiresAt: stored.expiresAt,
        payload: clonePayload(stored.payload),
      };
      return Promise.resolve(clonePayload(stored.payload));
    }

    if (pendingRequests[url]) {
      return pendingRequests[url].then(clonePayload);
    }

    if (stored && stored.etag) {
      headers["If-None-Match"] = stored.etag;
    }

    pendingRequests[url] = fetch(url, {
      credentials: "same-origin",
      headers: headers,
    })
      .then(function (response) {
        if (response.status === 304 && stored) {
          return refreshStoredBadgePayload(url, stored, response);
        }
        if (!response.ok) throw new Error(response.status);
        return response.json().then(function (payload) {
          return storeBadgePayload(url, payload, response);
        });
      })
      .finally(function () {
        delete pendingRequests[url];
      });

    return pendingRequests[url].then(clonePayload);
  }

  function readStoredBadgePayload(url) {
    var storage = safeStorage("localStorage");
    var value;
    var parsed;

    if (!storage) return null;

    try {
      value = storage.getItem(badgeStorageKey(url));
      parsed = value ? JSON.parse(value) : null;
    } catch {
      return null;
    }

    if (!parsed || !parsed.payload || !parsed.expiresAt) return null;

    return parsed;
  }

  function storeBadgePayload(url, payload, response) {
    var metadata = readBadgeCacheMetadata(response);

    if (metadata.noStore) {
      removeStoredBadgePayload(url);
      return payload;
    }

    requestCache[url] = {
      expiresAt: metadata.expiresAt,
      payload: clonePayload(payload),
    };
    writeStoredBadgePayload(url, {
      etag: metadata.etag,
      expiresAt: metadata.expiresAt,
      payload: payload,
    });

    return payload;
  }

  function refreshStoredBadgePayload(url, stored, response) {
    var metadata = readBadgeCacheMetadata(response);
    var payload = clonePayload(stored.payload);
    var expiresAt = metadata.expiresAt || Date.now() + badgeRequestTtlMs;

    if (metadata.noStore) {
      removeStoredBadgePayload(url);
      return payload;
    }

    requestCache[url] = {
      expiresAt: expiresAt,
      payload: clonePayload(payload),
    };
    writeStoredBadgePayload(url, {
      etag: metadata.etag || stored.etag || "",
      expiresAt: expiresAt,
      payload: payload,
    });

    return payload;
  }

  function readBadgeCacheMetadata(response) {
    var cacheControl = response.headers.get("cache-control") || "";
    var expiresAtHeader =
      response.headers.get("x-promo-pulse-cache-expires-at") || "";
    var maxAgeHeader =
      response.headers.get("x-promo-pulse-client-cache-max-age") || "";
    var expiresAt = Date.parse(expiresAtHeader);
    var maxAge = maxAgeHeader === "" ? NaN : Number(maxAgeHeader);
    var cacheControlMaxAge = readCacheControlMaxAge(cacheControl);
    var noStore = /\bno-store\b/i.test(cacheControl);

    if (noStore) {
      expiresAt = Date.now();
    } else if (!Number.isFinite(expiresAt)) {
      expiresAt =
        Date.now() +
        (Number.isFinite(maxAge) && maxAge >= 0
          ? Math.floor(maxAge) * 1000
          : cacheControlMaxAge !== null
            ? cacheControlMaxAge * 1000
            : badgeRequestTtlMs);
    }

    return {
      etag: response.headers.get("etag") || "",
      expiresAt: expiresAt,
      noStore: noStore,
    };
  }

  function readCacheControlMaxAge(value) {
    var match = String(value || "").match(/\bmax-age=(\d+)/i);

    return match ? Number(match[1]) : null;
  }

  function writeStoredBadgePayload(url, entry) {
    var storage = safeStorage("localStorage");

    if (!storage) return;

    try {
      storage.setItem(badgeStorageKey(url), JSON.stringify(entry));
    } catch {
      pruneStoredBadgePayloads(storage);
      try {
        storage.setItem(badgeStorageKey(url), JSON.stringify(entry));
      } catch {
        return;
      }
    }
  }

  function removeStoredBadgePayload(url) {
    var storage = safeStorage("localStorage");

    if (!storage) return;

    try {
      storage.removeItem(badgeStorageKey(url));
    } catch {
      return;
    }
  }

  function pruneStoredBadgePayloads(storage) {
    try {
      Object.keys(storage).forEach(function (key) {
        if (key.indexOf("promo_pulse_badges_") === 0) {
          storage.removeItem(key);
        }
      });
    } catch {
      return;
    }
  }

  function badgeStorageKey(url) {
    return "promo_pulse_badges_" + hashString(url);
  }

  function clonePayload(payload) {
    try {
      return JSON.parse(JSON.stringify(payload || {}));
    } catch {
      return payload || {};
    }
  }

  function hashString(value) {
    var hash = 2166136261;
    var index;

    for (index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
  }

  function initAutomaticBadges() {
    var embed = document.getElementById("promo-pulse-app-embed");

    if (!embed || embed.dataset.productBadgeAutoInit === "true") return;

    embed.dataset.productBadgeAutoInit = "true";
    initAutomaticProductPageBadge(embed);
    initAutomaticCollectionBadges(embed);
    observeAutomaticCollectionBadges(embed);
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
    if (embed.dataset.productId) return;

    findProductCardTargets().forEach(function (card) {
      var target;

      if (card.querySelector(".pp-product-badge")) return;

      target = findBadgeMountTarget(card);
      if (!target) return;

      ensureBadgeMountTarget(target);
      target.appendChild(createAutoSlot(embed, card, "COLLECTION_CARD"));
    });
  }

  function observeAutomaticCollectionBadges(embed) {
    var observer;

    if (embed.dataset.productId || !window.MutationObserver) return;

    observer = new MutationObserver(function () {
      window.clearTimeout(observer._promoPulseTimer);
      observer._promoPulseTimer = window.setTimeout(function () {
        initAutomaticCollectionBadges(embed);
      }, 120);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(function () {
      observer.disconnect();
    }, 15000);
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
    slot.dataset.selectedVariantId =
      readDatasetValue(source, "selectedVariantId") ||
      embed.dataset.selectedVariantId ||
      "";
    slot.dataset.inventoryQuantity =
      readDatasetValue(source, "inventoryQuantity") ||
      embed.dataset.inventoryQuantity ||
      "";
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
      querySelectorList(getSettingSelector("customProductPageBadgeSelector")) ||
      document.querySelector(
        "media-gallery, [id^='MediaGallery-'], [data-product-media], product-gallery, .product__media-wrapper, .product__media, .product-media-container, .product-gallery, .product__media-list",
      ) ||
      document.querySelector(
        "product-info, .product__info-container, .product-form, [data-product-information]",
      )
    );
  }

  function findProductCardTargets() {
    var cards = [];
    var seen = new Set();
    var customCards = querySelectorListAll(
      getSettingSelector("customCollectionCardSelector"),
    );

    [].slice
      .call(
        customCards.length
          ? customCards
          : document.querySelectorAll(
              "[data-product-card], .card-wrapper, .product-card, .product-grid-item, .grid__item, li, a[href*='/products/']",
            ),
      )
      .forEach(function (link) {
        var card =
          link.matches && link.matches('a[href*="/products/"]')
            ? link.closest(
                "[data-product-card], [data-product-id], .card-wrapper, .product-card, .product-grid-item, .grid__item, li",
              )
            : link;
        var productLink =
          card &&
          (card.matches('a[href*="/products/"]')
            ? card
            : card.querySelector('a[href*="/products/"]'));

        if (
          !card ||
          card.closest(".pp-root") ||
          seen.has(card) ||
          !productLink ||
          !card.querySelector("img")
        ) {
          return;
        }

        seen.add(card);
        cards.push(card);
      });

    return cards.slice(0, 48);
  }

  function getSettingSelector(key) {
    var settings = window.PromoPulseSettings || {};

    return settings[key] || "";
  }

  function querySelectorList(selector) {
    var matches = querySelectorListAll(selector);

    return matches[0] || null;
  }

  function querySelectorListAll(selector) {
    var selectors;
    var index;
    var currentSelector;
    var nodes;

    if (!selector || typeof selector !== "string") return [];

    selectors = selector
      .split(",")
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean);

    nodes = [];
    for (index = 0; index < selectors.length; index += 1) {
      currentSelector = selectors[index];

      try {
        nodes = nodes.concat(
          [].slice.call(document.querySelectorAll(currentSelector)),
        );
      } catch {
        // Ignore invalid merchant selectors and keep trying the rest.
      }
    }

    return nodes;
  }

  function findBadgeMountTarget(card) {
    var image = card.querySelector("img");
    var target;

    if (!image) return card;

    target =
      image.closest(
        "[data-product-card-media], .card__media, .product-card__media, .product-card__image-wrapper, .product-card__image, .grid-product__image-wrapper, .media, .card__inner",
      ) || card.querySelector(".card__media, .media, .card__inner");

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

  function renderBadges(root, badges) {
    var isAutomaticSlot = root.classList.contains("pp-product-badge--auto");
    var renderableBadges = selectRenderableBadges(
      badges,
      isAutomaticSlot ? 1 : 3,
    );

    root.replaceChildren();
    renderableBadges.forEach(function (badge) {
      root.appendChild(renderBadge(badge, isAutomaticSlot, root));
      emitBadgeImpression(badge);
    });
  }

  // Product context for message variables (e.g. {{quantity}} in badge text).
  function badgeContextVariables(slot) {
    var variables = {};
    if (!slot || !slot.dataset) return variables;

    var raw = slot.dataset.inventoryQuantity;
    var inventory = raw === "" || raw == null ? NaN : Number(raw);
    if (Number.isFinite(inventory)) {
      variables.quantity = String(Math.floor(inventory));
      variables.count = variables.quantity;
    }
    return variables;
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

  function renderBadge(badgePayload, isAutomaticSlot, slot) {
    var badge = badgePayload.badge || {};
    var design = normalizeDesign(badgePayload.design);
    var text = badge.badgeText || badgePayload.text || "Limited offer";
    var href = badge.url || "";
    var timerState = calculateTimerState(badgePayload, new Date());

    if (!window.CountPulseSurface) {
      return document.createElement("span");
    }

    var element = window.CountPulseSurface.build({
      variant: "badge",
      placement: badgePayload.placement || "PRODUCT_PAGE_BADGE",
      design: design,
      endsAt: badgePayload.endsAt,
      timezone: badgePayload.timezone,
      locale: document.documentElement.lang || "en",
      variables: badgeContextVariables(slot),
      headline: text,
      hasTimer: timerState.isActive,
      timer: {
        isActive: timerState.isActive,
        isExpired: timerState.isExpired,
        remainingMs: timerState.remainingMs,
      },
      badge: {
        text: text,
        shape: badge.badgeShape,
        position: badge.badgePosition,
      },
      dataTestId: "promo-badge",
    });

    element.dataset.campaignId = badgePayload.campaignId || badgePayload.id;
    if (badgePayload.ruleId) element.dataset.badgeRuleId = badgePayload.ruleId;
    element.setAttribute("role", "note");
    element.setAttribute("aria-label", element.textContent || text);

    if (href) {
      var link = document.createElement("a");
      link.href = href;
      link.className = "counterpulse-preview-badge-link";
      link.addEventListener("click", function () {
        emitBadgeClick(badgePayload);
      });
      while (element.firstChild) link.appendChild(element.firstChild);
      element.appendChild(link);
    }

    if (timerState.isActive) {
      startBadgeCountdown(element, badgePayload, design);
    }

    return element;
  }

  function startBadgeCountdown(element, badgePayload, design) {
    if (!element.querySelector("[data-cp-timer]")) return;

    window.setInterval(function () {
      var timerState = calculateTimerState(badgePayload, new Date());
      var countdown = element.querySelector("[data-cp-timer]");

      if (!countdown) return;

      if (timerState.isExpired) {
        countdown.remove();
        if (shouldHideExpiredBadge(badgePayload)) element.remove();
        return;
      }

      if (window.CountPulseSurface) {
        window.CountPulseSurface.updateTimer(
          countdown,
          timerState.remainingMs,
          design,
        );
      }
    }, 1000);
  }

  function calculateTimerState(badgePayload, now) {
    var timer = badgePayload.timer || {};
    var mode = timer.mode || "FIXED_DATE";

    if (mode === "EVERGREEN_SESSION") {
      return calculateEvergreenTimer(badgePayload, now);
    }

    return buildTimerState(now, parseDate(badgePayload.endsAt));
  }

  function calculateEvergreenTimer(badgePayload, now) {
    var timer = badgePayload.timer || {};
    var durationMinutes = Number(timer.durationMinutes);
    var storage = getEvergreenStorage(timer.resetBehavior);
    var key =
      "promo_pulse_badge_deadline_" +
      (badgePayload.campaignId || badgePayload.id);
    var stored = readStorage(storage, key);
    var endsAt = parseDate(stored && stored.endsAt);

    if (
      endsAt &&
      (endsAt.getTime() > now.getTime() ||
        timer.expiredBehavior !== "REPEAT_COUNTDOWN")
    ) {
      return buildTimerState(now, endsAt);
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return buildTimerState(now, parseDate(badgePayload.endsAt));
    }

    endsAt = new Date(now.getTime() + Math.round(durationMinutes) * 60000);
    writeStorage(storage, key, { endsAt: endsAt.toISOString() });

    return buildTimerState(now, endsAt);
  }

  function buildTimerState(now, endsAt) {
    var isExpired;

    if (!endsAt) {
      return { isActive: false, isExpired: false, remainingMs: 0 };
    }

    isExpired = endsAt.getTime() <= now.getTime();

    return {
      isActive: !isExpired,
      isExpired: isExpired,
      remainingMs: Math.max(0, endsAt.getTime() - now.getTime()),
    };
  }

  function shouldHideExpiredBadge(badgePayload) {
    var behavior =
      (badgePayload.timer || {}).expiredBehavior || "UNPUBLISH_TIMER";

    return behavior === "UNPUBLISH_TIMER" || behavior === "HIDE_TIMER";
  }

  function getEvergreenStorage(resetBehavior) {
    return safeStorage(
      resetBehavior === "ON_SESSION_END" ? "sessionStorage" : "localStorage",
    );
  }

  function readStorage(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function writeStorage(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function safeStorage(storageName) {
    try {
      return window[storageName] || null;
    } catch {
      return null;
    }
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
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

  function normalizeVariantId(value) {
    if (!value) return "";
    value = String(value);
    return value.indexOf("gid://") === 0
      ? value
      : "gid://shopify/ProductVariant/" + value;
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
    config.customProductPageBadgeSelector =
      settings.customProductPageBadgeSelector ||
      config.customProductPageBadgeSelector;
    config.customCollectionCardSelector =
      settings.customCollectionCardSelector ||
      config.customCollectionCardSelector;
  }

  function normalizeDesign(design) {
    if (
      window.CountPulseSurface &&
      typeof window.CountPulseSurface.normalizeDesign === "function"
    ) {
      return window.CountPulseSurface.normalizeDesign(design);
    }

    return design && typeof design === "object" && !Array.isArray(design)
      ? design
      : {};
  }
})();
