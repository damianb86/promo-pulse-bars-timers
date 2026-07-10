(function () {
  "use strict";

  var requestCache = {};
  var pendingRequests = {};
  var requestTtlMs = 5 * 60 * 1000;
  var storefrontPayloadStoragePrefix = "promo_pulse_storefront_payload_";
  var behaviorProfileStorageKey = "promo_pulse_behavior_profile";
  var behaviorSessionStorageKey = "promo_pulse_behavior_session_id";
  var behaviorPageViewStorageKey = "promo_pulse_behavior_page_view";
  var visitorIdStorageKey = "promo_pulse_visitor_id";
  var sessionIdStorageKey = "promo_pulse_session_id";
  var appliedDiscountStoragePrefix = "promo_pulse_applied_discount_";
  var lastSeenCampaignIdStorageKey = "promo_pulse_last_seen_campaign_id";
  var lastPromoTouchStorageKey = "promo_pulse_last_promo_touch";
  var maxBehaviorIds = 50;
  var maxIntentEvents = 100;
  var maxStoredSessions = 50;
  var behaviorEventTimestamps = {};
  var behaviorEventDedupeMs = 500;

  installCampaignBroker();
  installBehaviorProfileCollector();

  function installCampaignBroker() {
    if (
      window.PromoPulseFetchCampaigns &&
      window.PromoPulseFetchCampaigns.__promoPulseLoader === true
    ) {
      return;
    }

    window.PromoPulseFetchCampaigns = function (config, placement, options) {
      options = options || {};

      return fetchStorefrontCampaignPayload(config || {}, options).then(
        function (payload) {
          return buildStorefrontCampaignResult(
            payload,
            placement,
            options,
            config || {},
          );
        },
      );
    };
    window.PromoPulseFetchCampaigns.__promoPulseLoader = true;

    window.PromoPulseClearCampaignCache = function () {
      requestCache = {};
      pendingRequests = {};
      pruneStorefrontPayloadStorage(safeLocalStorage());
    };
  }

  function buildStorefrontCampaignResult(payload, placement, options, config) {
    return {
      campaigns: selectStorefrontCampaigns(payload, placement, options, config),
      settings: payload.settings || null,
      badgesEnabled: payload && payload.badges === true,
      url: payload.__promoPulseUrl || "",
    };
  }

  function fetchStorefrontCampaignPayload(config, options) {
    var url = buildStorefrontCampaignsUrl(config);
    var embedded = readEmbeddedStorefrontPayload(config, url);
    var cached = requestCache[url];
    var stored = readStorefrontPayloadCache(url);
    var now = Date.now();

    if (embedded) {
      requestCache[url] = {
        expiresAt: readPayloadExpiresAt(embedded, now),
        payload: clonePlainObject(embedded),
      };

      revalidateEmbeddedStorefrontPayload(embedded, url, stored, options);

      return Promise.resolve(embedded).then(clonePlainObject);
    }

    if (cached && cached.expiresAt > now) {
      return Promise.resolve(cached.payload).then(clonePlainObject);
    }

    if (stored && stored.expiresAt > now) {
      requestCache[url] = {
        expiresAt: stored.expiresAt,
        payload: clonePlainObject(stored.payload),
      };

      return Promise.resolve(stored.payload).then(clonePlainObject);
    }

    return requestStorefrontCampaignPayload(url, stored);
  }

  function readEmbeddedStorefrontPayload(config, url) {
    var raw =
      window.PromoPulseStorefrontPayload ||
      window.PromoPulseCampaignPayload ||
      window.PromoPulseCampaignConfigs ||
      window.PromoPulseStorefrontCampaigns ||
      null;
    var payload = normalizeEmbeddedStorefrontPayload(raw, config);
    var expiresAt;

    if (!payload || !embeddedPayloadMatchesConfig(payload, config)) {
      return null;
    }

    payload.__promoPulseUrl = "embedded:" + url;
    payload.__promoPulseEmbedded = true;
    expiresAt = Number(payload.__promoPulseClientExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      payload.__promoPulseClientExpiresAt = Date.now() + requestTtlMs;
    }
    if (payload.settings && typeof payload.settings === "object") {
      window.PromoPulseSettings = payload.settings;
    }

    return payload;
  }

  function normalizeEmbeddedStorefrontPayload(raw, config) {
    if (Array.isArray(raw)) {
      return buildOptimizedEmbeddedPayload({ campaigns: raw }, config);
    }

    if (raw && typeof raw === "object") {
      return buildOptimizedEmbeddedPayload(raw, config);
    }

    return null;
  }

  function buildOptimizedEmbeddedPayload(bundle, config) {
    var locale =
      readStorefrontConfigValue(config, "locale") ||
      readStorefrontConfigValue(config, "defaultLocale") ||
      document.documentElement.lang ||
      bundle.__promoPulseDefaultLocale ||
      "en";
    var device = readStorefrontConfigValue(config, "device") || detectDevice();
    var campaigns = Array.isArray(bundle.campaigns) ? bundle.campaigns : [];

    return {
      campaigns: campaigns.map(function (campaign) {
        return resolveOptimizedCampaign(campaign, locale, device, config);
      }),
      settings: bundle.settings || null,
      badges: bundle.badges === true,
      context: bundle.context || {},
      __promoPulseBundle: true,
      __promoPulseSchemaVersion: 2,
      __promoPulseGeneratedAt: bundle.__promoPulseGeneratedAt || "",
      __promoPulseRequiresRuntimeFetch:
        bundle.__promoPulseRequiresRuntimeFetch === true,
    };
  }

  function resolveOptimizedCampaign(campaign, locale, device, config) {
    var copy =
      campaign && typeof campaign === "object" && !Array.isArray(campaign)
        ? Object.assign({}, campaign)
        : {};

    copy.design = resolveOptimizedCampaignDesign(campaign, device);
    copy.texts = resolveOptimizedCampaignTexts(campaign, locale);
    copy.freeShipping = resolveOptimizedFreeShipping(campaign, config || {});
    copy.deliveryCutoff = resolveOptimizedDeliveryCutoff(
      campaign,
      config || {},
    );

    delete copy.mobileDesign;
    delete copy.textLocales;

    return copy;
  }

  function resolveOptimizedCampaignDesign(campaign, device) {
    var design = campaign && campaign.design ? campaign.design : {};
    var mobileDesign;

    if (
      (device === "mobile" || device === "tablet") &&
      campaign &&
      campaign.mobileDesign &&
      typeof campaign.mobileDesign === "object" &&
      !Array.isArray(campaign.mobileDesign)
    ) {
      mobileDesign = Object.assign({}, campaign.mobileDesign);

      if (!mobileDesign.structure && design && design.structure) {
        mobileDesign.structure = design.structure;
      }

      return mobileDesign;
    }

    return design;
  }

  function resolveOptimizedCampaignTexts(campaign, locale) {
    var base =
      campaign &&
      campaign.texts &&
      typeof campaign.texts === "object" &&
      !Array.isArray(campaign.texts)
        ? campaign.texts
        : {};
    var override = findOptimizedTextOverride(campaign, locale);

    return Object.assign({}, base, override);
  }

  function findOptimizedTextOverride(campaign, locale) {
    var textLocales =
      campaign &&
      campaign.textLocales &&
      typeof campaign.textLocales === "object" &&
      !Array.isArray(campaign.textLocales)
        ? campaign.textLocales
        : null;
    var normalizedLocale = normalizeLocale(locale);
    var direct;
    var language;
    var key;

    if (!textLocales) return {};

    direct = textLocales[locale] || textLocales[normalizedLocale];
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct;
    }

    language = normalizedLocale.split("-")[0];
    for (key in textLocales) {
      if (!Object.prototype.hasOwnProperty.call(textLocales, key)) continue;
      if (
        normalizeLocale(key) === normalizedLocale &&
        textLocales[key] &&
        typeof textLocales[key] === "object" &&
        !Array.isArray(textLocales[key])
      ) {
        return textLocales[key];
      }
      if (
        normalizeLocale(key) === language &&
        textLocales[key] &&
        typeof textLocales[key] === "object" &&
        !Array.isArray(textLocales[key])
      ) {
        return textLocales[key];
      }
    }

    return {};
  }

  function resolveOptimizedFreeShipping(campaign, config) {
    var settings =
      campaign &&
      campaign.freeShipping &&
      typeof campaign.freeShipping === "object" &&
      !Array.isArray(campaign.freeShipping)
        ? campaign.freeShipping
        : null;
    var rules = settings ? readPlainObject(settings.thresholdRules) : {};
    var threshold;
    var copy;

    if (!settings) return settings;

    copy = Object.assign({}, settings);
    delete copy.thresholdRules;

    if (Object.keys(rules).length === 0) return copy;

    threshold = resolveFreeShippingThreshold(rules, config);
    if (threshold !== null) {
      copy.thresholdAmount = formatAmount(threshold);
    }

    return copy;
  }

  function resolveFreeShippingThreshold(rules, config) {
    var market = readStorefrontConfigValue(config, "market") || detectMarket();
    var country = readStorefrontConfigValue(config, "country");
    var markets = readPlainObject(rules.markets);
    var countries = readPlainObject(rules.countries);

    return firstResolvedValue([
      readThresholdRule(markets, market),
      readThresholdRule(countries, country),
      readThresholdRule(rules, market + ":" + country),
      readThresholdRule(rules, market),
      readThresholdRule(rules, country),
      readNumericThreshold(rules.default),
    ]);
  }

  function readThresholdRule(source, key) {
    if (!key) return null;

    return readNumericThreshold(readPlainObject(source)[key]);
  }

  function readNumericThreshold(value) {
    var parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function resolveOptimizedDeliveryCutoff(campaign, config) {
    var settings =
      campaign &&
      campaign.deliveryCutoff &&
      typeof campaign.deliveryCutoff === "object" &&
      !Array.isArray(campaign.deliveryCutoff)
        ? campaign.deliveryCutoff
        : null;
    var rules = settings ? readPlainObject(settings.countryRules) : {};
    var override;
    var copy;

    if (!settings) return settings;

    copy = Object.assign({}, settings);
    delete copy.countryRules;

    if (Object.keys(rules).length === 0) return copy;

    override = resolveDeliveryCutoffOverride(rules, config);
    if (!override) return copy;

    return Object.assign(copy, override);
  }

  function resolveDeliveryCutoffOverride(rules, config) {
    var market = readStorefrontConfigValue(config, "market") || detectMarket();
    var country = readStorefrontConfigValue(config, "country");
    var markets = readPlainObject(rules.markets);
    var countries = readPlainObject(rules.countries);

    return firstResolvedValue([
      readRuleObject(markets, market),
      readRuleObject(countries, country),
      readRuleObject(rules, market),
      readRuleObject(rules, country),
    ]);
  }

  function readRuleObject(source, key) {
    var value;

    if (!key) return null;

    value = readPlainObject(source)[key];

    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  }

  function firstResolvedValue(values) {
    var index;

    for (index = 0; index < values.length; index += 1) {
      if (values[index] !== null && values[index] !== undefined) {
        return values[index];
      }
    }

    return null;
  }

  function revalidateEmbeddedStorefrontPayload(embedded, url, stored, options) {
    if (
      !embedded ||
      embedded.__promoPulseRequiresRuntimeFetch !== true ||
      !options ||
      typeof options.onRevalidate !== "function"
    ) {
      return;
    }

    requestStorefrontCampaignPayload(url, stored).then(function (payload) {
      if (payload && payload.__promoPulseFetchFailed !== true) {
        options.onRevalidate(payload);
      }
    });
  }

  function embeddedPayloadMatchesConfig(payload, config) {
    var context =
      (payload && payload.context) ||
      (payload && payload.__promoPulseContext) ||
      payload ||
      {};

    return (
      matchesOptionalContextValue(
        context.shop,
        readStorefrontConfigValue(config, "shop") || detectShop(getRoot()),
      ) &&
      matchesOptionalContextValue(
        context.path,
        window.location.pathname || "/",
      ) &&
      matchesOptionalContextValue(
        context.locale,
        readStorefrontConfigValue(config, "locale") ||
          readStorefrontConfigValue(config, "defaultLocale") ||
          document.documentElement.lang ||
          "en",
      ) &&
      matchesOptionalContextValue(
        context.device,
        readStorefrontConfigValue(config, "device") || detectDevice(),
      ) &&
      matchesOptionalContextValue(
        context.country,
        readStorefrontConfigValue(config, "country"),
      ) &&
      matchesOptionalContextValue(
        context.market,
        readStorefrontConfigValue(config, "market") || detectMarket(),
      )
    );
  }

  function matchesOptionalContextValue(expected, actual) {
    if (expected === undefined || expected === null || expected === "") {
      return true;
    }

    return (
      String(expected).toLowerCase() === String(actual || "").toLowerCase()
    );
  }

  function requestStorefrontCampaignPayload(url, stored) {
    var request;
    var headers;

    if (pendingRequests[url]) {
      return pendingRequests[url].then(clonePlainObject);
    }

    headers = { Accept: "application/json" };
    if (stored && stored.etag) {
      headers["If-None-Match"] = stored.etag;
    }

    request = window
      .fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: headers,
      })
      .then(function (response) {
        if (response.status === 304 && stored) {
          return refreshStoredStorefrontPayload(url, stored, response);
        }
        if (!response.ok) throw new Error(response.status);
        assertStorefrontJsonResponse(response, url);
        return response.json().then(function (payload) {
          return storeStorefrontPayload(url, payload, response);
        });
      })
      .then(function (payload) {
        payload = payload && typeof payload === "object" ? payload : {};
        payload.__promoPulseUrl = url;
        requestCache[url] = {
          expiresAt: readPayloadExpiresAt(payload, Date.now()),
          payload: clonePlainObject(payload),
        };
        window.PromoPulseSettings =
          payload.settings && typeof payload.settings === "object"
            ? payload.settings
            : {};
        return payload;
      })
      .catch(function (error) {
        debug(getRoot(), error);
        return {
          campaigns: [],
          settings: null,
          __promoPulseUrl: url,
          __promoPulseFetchFailed: true,
        };
      })
      .finally(function () {
        delete pendingRequests[url];
      });

    pendingRequests[url] = request;

    return request.then(clonePlainObject);
  }

  function readStorefrontPayloadCache(url) {
    var storage = safeLocalStorage();
    var value;
    var parsed;

    if (!storage) return null;

    try {
      value = storage.getItem(storefrontPayloadStorageKey(url));
      parsed = value ? JSON.parse(value) : null;
    } catch {
      return null;
    }

    if (!parsed || !parsed.payload || !parsed.expiresAt) return null;

    return parsed;
  }

  function storeStorefrontPayload(url, payload, response) {
    var metadata = readStorefrontCacheMetadata(response);
    var storedPayload =
      payload && typeof payload === "object" ? payload : { campaigns: [] };

    storedPayload.__promoPulseUrl = url;
    if (metadata.noStore) {
      removeStorefrontPayloadCache(url);
      storedPayload.__promoPulseClientExpiresAt = Date.now();
      storedPayload.__promoPulseEtag = "";
      storedPayload.__promoPulseNoStore = true;
      return storedPayload;
    }

    metadata.expiresAt = resolveStorefrontPayloadExpiresAt(
      storedPayload,
      metadata.expiresAt,
    );
    storedPayload.__promoPulseClientExpiresAt = metadata.expiresAt;
    storedPayload.__promoPulseEtag = metadata.etag;
    writeStorefrontPayloadCache(url, {
      etag: metadata.etag,
      expiresAt: metadata.expiresAt,
      payload: storedPayload,
    });

    return storedPayload;
  }

  function refreshStoredStorefrontPayload(url, stored, response) {
    var metadata = readStorefrontCacheMetadata(response);
    var payload = clonePlainObject(stored.payload);
    var expiresAt = resolveStorefrontPayloadExpiresAt(
      payload,
      metadata.expiresAt,
    );
    var etag = metadata.etag || stored.etag || "";

    if (metadata.noStore) {
      removeStorefrontPayloadCache(url);
      payload.__promoPulseUrl = url;
      payload.__promoPulseClientExpiresAt = Date.now();
      payload.__promoPulseEtag = "";
      payload.__promoPulseNoStore = true;
      return payload;
    }

    payload.__promoPulseUrl = url;
    payload.__promoPulseClientExpiresAt = expiresAt;
    payload.__promoPulseEtag = etag;
    writeStorefrontPayloadCache(url, {
      etag: etag,
      expiresAt: expiresAt,
      payload: payload,
    });

    return payload;
  }

  function writeStorefrontPayloadCache(url, entry) {
    var storage = safeLocalStorage();

    if (!storage) return;

    try {
      storage.setItem(storefrontPayloadStorageKey(url), JSON.stringify(entry));
    } catch {
      pruneStorefrontPayloadStorage(storage);
      try {
        storage.setItem(
          storefrontPayloadStorageKey(url),
          JSON.stringify(entry),
        );
      } catch {
        return;
      }
    }
  }

  function removeStorefrontPayloadCache(url) {
    var storage = safeLocalStorage();

    if (!storage) return;

    try {
      storage.removeItem(storefrontPayloadStorageKey(url));
    } catch {
      return;
    }
  }

  function readStorefrontCacheMetadata(response) {
    var cacheControl = response.headers.get("cache-control") || "";
    var expiresAtHeader =
      response.headers.get("x-promo-pulse-cache-expires-at") || "";
    var maxAgeHeader =
      response.headers.get("x-promo-pulse-client-cache-max-age") || "";
    var expiresAt = Date.parse(expiresAtHeader);
    var maxAge = maxAgeHeader === "" ? NaN : Number(maxAgeHeader);
    var noStore = /\bno-store\b/i.test(cacheControl);

    if (noStore) {
      expiresAt = Date.now();
    } else if (!Number.isFinite(expiresAt)) {
      expiresAt =
        Date.now() +
        (Number.isFinite(maxAge) && maxAge >= 0
          ? Math.floor(maxAge) * 1000
          : requestTtlMs);
    }

    return {
      etag: response.headers.get("etag") || "",
      expiresAt: expiresAt,
      noStore: noStore,
    };
  }

  function resolveStorefrontPayloadExpiresAt(payload, configuredExpiresAt) {
    var now = Date.now();
    var minimumExpiresAt = now + requestTtlMs;
    var expiresAt = Number.isFinite(configuredExpiresAt)
      ? Math.max(configuredExpiresAt, minimumExpiresAt)
      : minimumExpiresAt;
    var timerExpiresAt = readEarliestCampaignTimerExpiresAt(payload, now);

    return timerExpiresAt ? Math.min(expiresAt, timerExpiresAt) : expiresAt;
  }

  function readEarliestCampaignTimerExpiresAt(payload, now) {
    var campaigns =
      payload && Array.isArray(payload.campaigns) ? payload.campaigns : [];
    var earliest = Infinity;

    campaigns.forEach(function (campaign) {
      var endsAt;

      if (!campaign || !campaign.timer || !campaign.endsAt) return;

      endsAt = Date.parse(campaign.endsAt);
      if (Number.isFinite(endsAt) && endsAt > now && endsAt < earliest) {
        earliest = endsAt;
      }
    });

    return Number.isFinite(earliest) ? earliest : 0;
  }

  function readPayloadExpiresAt(payload, fallbackNow) {
    if (payload && payload.__promoPulseNoStore) return 0;

    var expiresAt = Number(payload && payload.__promoPulseClientExpiresAt);

    return Number.isFinite(expiresAt) ? expiresAt : fallbackNow + requestTtlMs;
  }

  function storefrontPayloadStorageKey(url) {
    return storefrontPayloadStoragePrefix + hashString(url);
  }

  function pruneStorefrontPayloadStorage(storage) {
    if (!storage) return;

    try {
      Object.keys(storage).forEach(function (key) {
        if (key.indexOf(storefrontPayloadStoragePrefix) === 0) {
          storage.removeItem(key);
        }
      });
    } catch {
      return;
    }
  }

  function buildStorefrontCampaignsUrl(config) {
    var params = new URLSearchParams({
      shop: readStorefrontConfigValue(config, "shop") || detectShop(getRoot()),
      path: window.location.pathname || "/",
      locale:
        readStorefrontConfigValue(config, "locale") ||
        readStorefrontConfigValue(config, "defaultLocale") ||
        document.documentElement.lang ||
        "en",
      device: readStorefrontConfigValue(config, "device") || detectDevice(),
      placement: "ALL_FRONT_DEFAULT_PLACEMENTS",
    });
    var country = readStorefrontConfigValue(config, "country");
    var market = readStorefrontConfigValue(config, "market") || detectMarket();
    var currency =
      readStorefrontConfigValue(config, "currency") || detectCurrency();
    var productId = readStorefrontConfigValue(config, "productId");
    var productTags = readStorefrontList(config.productTags);
    var collectionIds = readStorefrontList(config.collectionIds);
    var customerTags = readStorefrontList(config.customerTags);
    var cartSubtotal = config.cartSubtotal;
    var utmSource =
      readStorefrontConfigValue(config, "utmSource") ||
      new URLSearchParams(window.location.search).get("utm_source") ||
      "";

    if (country) params.set("country", country);
    if (market) params.set("market", market);
    if (currency) params.set("currency", currency);
    if (productId) params.set("productId", productId);
    if (productTags.length) params.set("productTags", productTags.join(","));
    if (collectionIds.length) {
      params.set("collectionIds", collectionIds.join(","));
    }
    if (customerTags.length) {
      params.set("customerTags", customerTags.join(","));
    }
    if (Number.isFinite(cartSubtotal)) {
      params.set("cartSubtotal", String(cartSubtotal));
    }
    if (utmSource) params.set("utmSource", utmSource);
    appendStorefrontTrackingParams(params);

    return getStorefrontCampaignsEndpoint(config) + "?" + params.toString();
  }

  function getStorefrontCampaignsEndpoint(config) {
    var root = getRoot();
    var value =
      window.PromoPulseApiBaseUrl ||
      readStorefrontConfigValue(config, "apiBaseUrl") ||
      (root && root.dataset.apiBaseUrl) ||
      "";

    value = String(value).trim().replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/promo-pulse";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function selectStorefrontCampaigns(payload, placement, options, config) {
    var requestedPlacements = readPlacementList(placement);
    var campaignId = String((options && options.campaignId) || "");
    var campaigns = Array.isArray(payload && payload.campaigns)
      ? payload.campaigns
      : [];
    var matching;
    var matchingById;
    var anyById;

    campaigns = campaigns
      .filter(campaignIsVisibleForCurrentTime)
      .map(function (campaign) {
        return applyEmbeddedMarketRules(campaign, config || {});
      })
      .filter(Boolean)
      .filter(function (campaign) {
        return campaignMatchesEmbeddedTargeting(
          campaign,
          config || {},
          requestedPlacements,
        );
      });
    campaigns = expandCampaignPlacements(campaigns);

    matching = requestedPlacements.length
      ? campaigns.filter(function (campaign) {
          return requestedPlacements.indexOf(campaign.placement) !== -1;
        })
      : campaigns.slice();

    if (!campaignId) return normalizeCampaigns(matching);

    matchingById = matching.filter(function (campaign) {
      return campaign.id === campaignId;
    });

    if (
      matchingById.length ||
      requestedPlacements.indexOf("CUSTOM_SELECTOR") !== -1
    ) {
      return normalizeCampaigns(matchingById);
    }

    anyById = campaigns.filter(function (campaign) {
      return campaign.id === campaignId;
    });

    return normalizeCampaigns(anyById.length ? anyById : matchingById);
  }

  function expandCampaignPlacements(campaigns) {
    var expanded = [];

    campaigns.forEach(function (campaign) {
      var placements =
        campaign &&
        campaign.placements &&
        typeof campaign.placements.length === "number" &&
        campaign.placements.length > 0
          ? campaign.placements
          : null;

      if (!placements) return;

      placements.forEach(function (descriptor) {
        var placement = String(
          descriptor && (descriptor.placement || descriptor.placementType),
        ).toUpperCase();
        var copy;

        if (!placement) return;

        copy = Object.assign({}, campaign);
        copy.placement = placement;
        copy.placementSelector =
          (descriptor && descriptor.placementSelector) ||
          (descriptor && descriptor.customSelector) ||
          "";
        copy.placementStyle =
          (descriptor && descriptor.placementStyle) ||
          (descriptor && descriptor.customStyle) ||
          "";
        delete copy.placements;
        expanded.push(copy);
      });
    });

    return expanded;
  }

  function campaignIsVisibleForCurrentTime(campaign) {
    var now = Date.now();
    var startsAt = Date.parse(campaign && campaign.startsAt);
    var endsAt = Date.parse(campaign && campaign.endsAt);
    var expiredBehavior =
      campaign &&
      campaign.timer &&
      (campaign.timer.expiredBehavior || "UNPUBLISH_TIMER");

    if (Number.isFinite(startsAt) && startsAt > now) return false;
    if (
      Number.isFinite(endsAt) &&
      endsAt < now &&
      expiredBehavior === "UNPUBLISH_TIMER"
    ) {
      return false;
    }

    return true;
  }

  function campaignMatchesEmbeddedTargeting(
    campaign,
    config,
    requestedPlacements,
  ) {
    var targeting =
      (campaign && campaign.targeting) ||
      (campaign && campaign.__promoPulseTargeting) ||
      null;
    var paths = getTargetingPathCandidates(requestedPlacements);
    var productId = readStorefrontConfigValue(config, "productId");
    var collectionIds = readStorefrontConfigList(config, "collectionIds");
    var productTags = readStorefrontConfigList(config, "productTags");
    var customerTags = readStorefrontConfigList(config, "customerTags");

    if (!targeting || typeof targeting !== "object") return true;

    if (
      matchesAny(readTargetingList(targeting.excludeProductIds), [productId])
    ) {
      return false;
    }

    if (
      matchesAny(
        readTargetingList(targeting.excludeCollectionIds),
        collectionIds,
      )
    ) {
      return false;
    }

    if (
      matchesPathContains(
        readTargetingList(targeting.excludedUrlContains),
        paths,
      )
    ) {
      return false;
    }

    return (
      matchesOptionalExactList(
        readTargetingList(targeting.countries),
        readStorefrontConfigValue(config, "country"),
      ) &&
      matchesOptionalExactList(
        readTargetingList(targeting.markets),
        readStorefrontConfigValue(config, "market") || detectMarket(),
      ) &&
      matchesOptionalLocaleList(
        readTargetingList(targeting.locales),
        readStorefrontConfigValue(config, "locale") ||
          readStorefrontConfigValue(config, "defaultLocale") ||
          document.documentElement.lang ||
          "en",
      ) &&
      matchesOptionalExactList(
        readTargetingList(targeting.productIds),
        productId,
      ) &&
      matchesOptionalIntersection(
        readTargetingList(targeting.collectionIds),
        collectionIds,
      ) &&
      matchesOptionalIntersection(
        readTargetingList(targeting.productTags),
        productTags,
      ) &&
      matchesOptionalIntersection(
        readTargetingList(targeting.customerTags),
        customerTags,
      ) &&
      matchesOptionalPathContains(
        readTargetingList(targeting.urlContains),
        paths,
      ) &&
      matchesOptionalExactList(
        readTargetingList(targeting.utmSources),
        readStorefrontConfigValue(config, "utmSource") ||
          new URLSearchParams(window.location.search).get("utm_source") ||
          "",
      ) &&
      matchesOptionalExactList(
        readTargetingList(targeting.devices),
        readStorefrontConfigValue(config, "device") || detectDevice(),
      ) &&
      campaignMatchesBehaviorRules(targeting.behaviorRules)
    );
  }

  function getTargetingPathCandidates(requestedPlacements) {
    var paths = [window.location.pathname || "/"];
    var placements = Array.isArray(requestedPlacements)
      ? requestedPlacements
      : [];

    if (
      placements.some(function (placement) {
        return placement === "CART_DRAWER" || placement === "CART_PAGE";
      }) &&
      paths.indexOf("/cart") === -1
    ) {
      paths.push("/cart");
    }

    return paths;
  }

  function applyEmbeddedMarketRules(campaign, config) {
    var rules =
      (campaign &&
        (campaign.marketRules || campaign.__promoPulseMarketRules)) ||
      [];
    var rule;
    var copy;
    var deliverySettings;
    var textOverrides;

    if (!Array.isArray(rules) || rules.length === 0) return campaign;

    rule = findBestMarketRule(rules, getMarketContext(config));
    if (!rule) return campaign;
    if (rule.enabled === false) return null;

    copy = Object.assign({}, campaign);
    deliverySettings = readPlainObject(rule.deliverySettings);
    textOverrides = readPlainObject(rule.textOverrides);

    if (copy.freeShipping && typeof copy.freeShipping === "object") {
      copy.freeShipping = Object.assign({}, copy.freeShipping);
      if (rule.thresholdAmount !== undefined && rule.thresholdAmount !== null) {
        copy.freeShipping.thresholdAmount = formatAmount(rule.thresholdAmount);
      }
      if (normalizeCurrency(rule.currencyCode)) {
        copy.freeShipping.currencyCode = normalizeCurrency(rule.currencyCode);
      }
    }

    if (
      copy.deliveryCutoff &&
      typeof copy.deliveryCutoff === "object" &&
      Object.keys(deliverySettings).length > 0
    ) {
      copy.deliveryCutoff = Object.assign(
        {},
        copy.deliveryCutoff,
        deliverySettings,
      );
    }

    if (
      copy.texts &&
      typeof copy.texts === "object" &&
      Object.keys(textOverrides).length > 0
    ) {
      copy.texts = Object.assign({}, copy.texts, textOverrides);
    }

    return copy;
  }

  function findBestMarketRule(rules, context) {
    var best = null;
    var bestScore = -1;

    rules.forEach(function (rule) {
      var score = scoreMarketRule(rule, context);

      if (score > bestScore) {
        best = rule;
        bestScore = score;
      }
    });

    return bestScore >= 0 ? best : null;
  }

  function scoreMarketRule(rule, context) {
    var score = 0;
    var hasConstraint = false;

    if (rule.marketId) {
      hasConstraint = true;
      if (normalizeMarketId(rule.marketId) !== context.marketId) return -1;
      score += 8;
    }

    if (rule.countryCode) {
      hasConstraint = true;
      if (normalizeCountry(rule.countryCode) !== context.countryCode) {
        return -1;
      }
      score += 4;
    }

    if (rule.locale) {
      hasConstraint = true;
      if (!localeMatches(rule.locale, context.locale)) return -1;
      score += 2;
    }

    if (rule.currencyCode) {
      hasConstraint = true;
      if (normalizeCurrency(rule.currencyCode) !== context.currencyCode) {
        return -1;
      }
      score += 1;
    }

    return hasConstraint ? score : -1;
  }

  function getMarketContext(config) {
    return {
      marketId: normalizeMarketId(
        readStorefrontConfigValue(config, "market") || detectMarket(),
      ),
      countryCode: normalizeCountry(
        readStorefrontConfigValue(config, "country"),
      ),
      locale: normalizeLocale(
        readStorefrontConfigValue(config, "locale") ||
          readStorefrontConfigValue(config, "defaultLocale") ||
          document.documentElement.lang ||
          "en",
      ),
      currencyCode: normalizeCurrency(
        readStorefrontConfigValue(config, "currency") || detectCurrency(),
      ),
    };
  }

  function localeMatches(ruleLocale, contextLocale) {
    var normalizedRuleLocale = normalizeLocale(ruleLocale);
    var normalizedContextLocale = normalizeLocale(contextLocale);

    return (
      normalizedRuleLocale === normalizedContextLocale ||
      normalizedRuleLocale === normalizedContextLocale.split("-")[0]
    );
  }

  function campaignMatchesBehaviorRules(behaviorRules) {
    var rules = normalizeBehaviorRules(behaviorRules);
    var profile;

    if (!rules.enabled || rules.segments.length === 0) return true;

    profile = readBehaviorProfile();
    if (!profile.canUseBehaviorTargeting) return false;

    return rules.segments.some(function (segment) {
      return behaviorSegmentMatches(segment, profile, rules);
    });
  }

  function behaviorSegmentMatches(segment, profile, rules) {
    var now = Date.now();

    if (segment === "NEW_VISITOR") {
      return (
        profile.totalTouches === 0 &&
        profile.usedUniqueCodeCampaignIds.length === 0 &&
        profile.assignedUniqueCodeCampaignIds.length === 0
      );
    }

    if (segment === "RETURNING_VISITOR") {
      if (profile.priorSessionCount < rules.returningMinPriorSessions) {
        return false;
      }
      if (rules.returningMinDaysSinceFirstSeen > 0) {
        if (!profile.firstSeenAt) return false;
        if (
          daysBetween(profile.firstSeenAt, now) <
          rules.returningMinDaysSinceFirstSeen
        ) {
          return false;
        }
      }
      return true;
    }

    if (segment === "VIEWED_PRODUCT_NO_ADD_TO_CART") {
      if (!profile.latestProductViewedAt) return false;
      if (profile.productViewCount < rules.viewedProductMinViews) {
        return false;
      }
      if (
        profile.latestAddToCartAt &&
        profile.latestAddToCartAt >= profile.latestProductViewedAt
      ) {
        return false;
      }
      return (
        minutesBetween(profile.latestProductViewedAt, now) >=
        rules.viewedProductDelayMinutes
      );
    }

    if (segment === "ADDED_TO_CART_NO_CHECKOUT") {
      if (!profile.latestAddToCartAt) return false;
      if (
        profile.latestCheckoutStartedAt &&
        profile.latestCheckoutStartedAt >= profile.latestAddToCartAt
      ) {
        return false;
      }
      return (
        minutesBetween(profile.latestAddToCartAt, now) >=
        rules.addedToCartDelayMinutes
      );
    }

    if (segment === "CHECKOUT_STARTED") {
      if (!profile.latestCheckoutStartedAt) return false;
      if (
        rules.checkoutStartedExcludePurchasers &&
        profile.latestOrderAt &&
        profile.latestOrderAt >= profile.latestCheckoutStartedAt
      ) {
        return false;
      }
      return (
        minutesBetween(profile.latestCheckoutStartedAt, now) >=
        rules.checkoutStartedDelayMinutes
      );
    }

    if (segment === "SAW_CAMPAIGN") {
      return matchesCampaignSet(profile.sawCampaignIds, rules.sawCampaignIds);
    }

    if (segment === "CLICKED_CAMPAIGN") {
      return matchesCampaignSet(
        profile.clickedCampaignIds,
        rules.clickedCampaignIds,
      );
    }

    if (segment === "USED_UNIQUE_CODE") {
      return (
        profile.usedUniqueCodeCampaignIds.length > 0 ||
        (rules.usedUniqueCodeIncludeAssigned &&
          profile.assignedUniqueCodeCampaignIds.length > 0)
      );
    }

    if (segment === "HIGH_INTENT") {
      return (
        profile.intentEventTimes.filter(function (time) {
          return (
            now - time <= rules.highIntentWindowMinutes * 60 * 1000 &&
            time <= now
          );
        }).length >= rules.highIntentMinEvents
      );
    }

    if (segment === "INACTIVE_CART") {
      if (!profile.latestAddToCartAt) return false;
      if (
        profile.latestCheckoutStartedAt &&
        profile.latestCheckoutStartedAt >= profile.latestAddToCartAt
      ) {
        return false;
      }
      if (
        profile.latestOrderAt &&
        profile.latestOrderAt >= profile.latestAddToCartAt
      ) {
        return false;
      }
      return (
        minutesBetween(profile.latestAddToCartAt, now) >=
        rules.inactiveCartMinutes
      );
    }

    return false;
  }

  function normalizeBehaviorRules(value) {
    var input = readPlainObject(value);
    var defaultRules = {
      enabled: false,
      segments: [],
      campaignIds: [],
      lookbackDays: 30,
      returningMinPriorSessions: 1,
      returningMinDaysSinceFirstSeen: 0,
      viewedProductMinViews: 1,
      viewedProductDelayMinutes: 0,
      addedToCartDelayMinutes: 0,
      checkoutStartedDelayMinutes: 0,
      checkoutStartedExcludePurchasers: true,
      inactiveCartMinutes: 60,
      sawCampaignIds: [],
      clickedCampaignIds: [],
      usedUniqueCodeIncludeAssigned: false,
      highIntentMinEvents: 3,
      highIntentWindowMinutes: 60,
    };
    var legacyCampaignIds = readTargetingList(input.campaignIds);

    return {
      enabled: input.enabled === true || input.enabled === "true",
      segments: readBehaviorSegmentList(input.segments),
      campaignIds: legacyCampaignIds,
      lookbackDays: readBoundedInteger(input.lookbackDays, 1, 365, 30),
      returningMinPriorSessions: readBoundedInteger(
        input.returningMinPriorSessions,
        1,
        50,
        defaultRules.returningMinPriorSessions,
      ),
      returningMinDaysSinceFirstSeen: readBoundedInteger(
        input.returningMinDaysSinceFirstSeen,
        0,
        365,
        defaultRules.returningMinDaysSinceFirstSeen,
      ),
      viewedProductMinViews: readBoundedInteger(
        input.viewedProductMinViews,
        1,
        50,
        defaultRules.viewedProductMinViews,
      ),
      viewedProductDelayMinutes: readBoundedInteger(
        input.viewedProductDelayMinutes,
        0,
        10080,
        defaultRules.viewedProductDelayMinutes,
      ),
      addedToCartDelayMinutes: readBoundedInteger(
        input.addedToCartDelayMinutes,
        0,
        10080,
        defaultRules.addedToCartDelayMinutes,
      ),
      checkoutStartedDelayMinutes: readBoundedInteger(
        input.checkoutStartedDelayMinutes,
        0,
        10080,
        defaultRules.checkoutStartedDelayMinutes,
      ),
      checkoutStartedExcludePurchasers: readBoolean(
        input.checkoutStartedExcludePurchasers,
        defaultRules.checkoutStartedExcludePurchasers,
      ),
      inactiveCartMinutes: readBoundedInteger(
        input.inactiveCartMinutes,
        15,
        10080,
        defaultRules.inactiveCartMinutes,
      ),
      sawCampaignIds: Object.prototype.hasOwnProperty.call(
        input,
        "sawCampaignIds",
      )
        ? readTargetingList(input.sawCampaignIds)
        : legacyCampaignIds,
      clickedCampaignIds: Object.prototype.hasOwnProperty.call(
        input,
        "clickedCampaignIds",
      )
        ? readTargetingList(input.clickedCampaignIds)
        : legacyCampaignIds,
      usedUniqueCodeIncludeAssigned: readBoolean(
        input.usedUniqueCodeIncludeAssigned,
        defaultRules.usedUniqueCodeIncludeAssigned,
      ),
      highIntentMinEvents: readBoundedInteger(
        input.highIntentMinEvents,
        2,
        20,
        defaultRules.highIntentMinEvents,
      ),
      highIntentWindowMinutes: readBoundedInteger(
        input.highIntentWindowMinutes,
        5,
        1440,
        defaultRules.highIntentWindowMinutes,
      ),
    };
  }

  function readBehaviorSegmentList(value) {
    var allowed = {
      NEW_VISITOR: true,
      RETURNING_VISITOR: true,
      VIEWED_PRODUCT_NO_ADD_TO_CART: true,
      ADDED_TO_CART_NO_CHECKOUT: true,
      CHECKOUT_STARTED: true,
      SAW_CAMPAIGN: true,
      CLICKED_CAMPAIGN: true,
      USED_UNIQUE_CODE: true,
      HIGH_INTENT: true,
      INACTIVE_CART: true,
    };

    return readTargetingList(value).filter(function (item) {
      return allowed[item] === true;
    });
  }

  function installBehaviorProfileCollector() {
    var root = getRoot();
    var productId = root && root.dataset.productId;

    touchBehaviorSession();

    if (productId) {
      rememberBehaviorProfileEvent("PRODUCT_VIEWED", { productId: productId });
    }
    if (isCheckoutPath(window.location && window.location.pathname)) {
      rememberBehaviorProfileEvent("CHECKOUT_STARTED", null);
    }

    document.addEventListener("promo-pulse:impression", function (event) {
      rememberBehaviorProfileEvent("IMPRESSION", event.detail || {});
    });
    document.addEventListener("promo-pulse:badge-impression", function (event) {
      rememberBehaviorProfileEvent("IMPRESSION", event.detail || {});
    });
    document.addEventListener("promo-pulse:click", function (event) {
      rememberBehaviorProfileEvent("CLICK", event.detail || {});
    });
    document.addEventListener("promo-pulse:badge-click", function (event) {
      rememberBehaviorProfileEvent("CLICK", event.detail || {});
    });
    document.addEventListener("promo-pulse:copy-code", function (event) {
      rememberBehaviorProfileEvent("COPY_CODE", event.detail || {});
    });

    document.addEventListener(
      "submit",
      function (event) {
        var target = event && event.target;

        if (isAddToCartForm(target)) {
          rememberBehaviorProfileEvent("ADD_TO_CART", null);
          return;
        }
        if (isCheckoutForm(target)) {
          rememberBehaviorProfileEvent("CHECKOUT_STARTED", null);
        }
      },
      true,
    );
    document.addEventListener(
      "click",
      function (event) {
        var target = event && event.target;

        if (isCheckoutTrigger(target)) {
          rememberBehaviorProfileEvent("CHECKOUT_STARTED", null);
          return;
        }
        if (isAddToCartTrigger(target)) {
          rememberBehaviorProfileEvent("ADD_TO_CART", null);
        }
      },
      true,
    );

    window.PromoPulseRememberBehaviorEvent = rememberBehaviorProfileEvent;
  }

  function touchBehaviorSession() {
    var storage = safeLocalStorage();
    var sessionStorage = safeSessionStorage();
    var now = Date.now();
    var sessionId;
    var profile;

    if (!storage || !sessionStorage) return;

    sessionId =
      readStoredValue("sessionStorage", sessionIdStorageKey) ||
      readStoredValue("sessionStorage", behaviorSessionStorageKey);
    if (!sessionId) {
      sessionId = createTrackingId("ppbs");
      writeStoredValue("sessionStorage", behaviorSessionStorageKey, sessionId);
    }

    profile = readStoredBehaviorProfile();
    if (!profile.firstSeenAt) profile.firstSeenAt = now;
    profile.lastSeenAt = now;

    if (profile.sessionIds.indexOf(sessionId) === -1) {
      profile.sessionIds.push(sessionId);
      profile.sessionIds = profile.sessionIds.slice(-maxStoredSessions);
      profile.sessionCount = profile.sessionIds.length;
    }

    writeBehaviorProfile(profile);
  }

  function rememberBehaviorProfileEvent(eventType, campaign, extra) {
    var type = String(eventType || "").toUpperCase();
    var profile = readStoredBehaviorProfile();
    var campaignId =
      (campaign && (campaign.campaignId || campaign.id)) ||
      (extra && (extra.campaignId || extra.id)) ||
      "";
    var now = Date.now();

    if (wasBehaviorEventTrackedRecently(type, campaignId, now)) return;

    if (!profile.firstSeenAt) profile.firstSeenAt = now;
    profile.lastSeenAt = now;

    if (type === "PRODUCT_VIEWED") {
      if (!wasProductViewRecorded(campaign && campaign.productId)) {
        profile.productViewCount += 1;
      }
      profile.latestProductViewedAt = now;
      appendIntentEvent(profile, now);
    } else if (type === "IMPRESSION" || type === "BADGE_IMPRESSION") {
      profile.totalTouches += 1;
      appendUnique(profile.sawCampaignIds, campaignId);
    } else if (
      type === "CLICK" ||
      type === "BADGE_CLICK" ||
      type === "COPY_CODE" ||
      type === "APPLY_CODE_CLICKED"
    ) {
      appendUnique(profile.clickedCampaignIds, campaignId);
      appendIntentEvent(profile, now);
    } else if (type === "UNIQUE_CODE_ASSIGNED") {
      appendUnique(profile.assignedUniqueCodeCampaignIds, campaignId);
      appendIntentEvent(profile, now);
    } else if (type === "ADD_TO_CART") {
      profile.latestAddToCartAt = now;
      appendIntentEvent(profile, now);
    } else if (type === "CHECKOUT_STARTED") {
      profile.latestCheckoutStartedAt = now;
      appendIntentEvent(profile, now);
    } else if (type === "ORDER_COMPLETED" || type === "PURCHASE") {
      profile.latestOrderAt = now;
      appendIntentEvent(profile, now);
    }

    writeBehaviorProfile(profile);
  }

  function wasBehaviorEventTrackedRecently(type, campaignId, now) {
    var key = [
      type,
      isCommerceBehaviorEvent(type) ? window.location.pathname || "" : "",
      isCommerceBehaviorEvent(type) ? "" : campaignId || "",
    ].join(":");
    var previous = behaviorEventTimestamps[key] || 0;

    if (previous && now - previous < behaviorEventDedupeMs) return true;

    behaviorEventTimestamps[key] = now;
    return false;
  }

  function isCommerceBehaviorEvent(type) {
    return (
      type === "ADD_TO_CART" ||
      type === "CHECKOUT_STARTED" ||
      type === "ORDER_COMPLETED" ||
      type === "PURCHASE"
    );
  }

  function wasProductViewRecorded(productId) {
    var key = [productId || "", window.location.pathname || ""].join(":");
    var previous = readStoredValue(
      "sessionStorage",
      behaviorPageViewStorageKey,
    );

    if (previous === key) return true;

    writeStoredValue("sessionStorage", behaviorPageViewStorageKey, key);
    return false;
  }

  function readBehaviorProfile() {
    var profile = readStoredBehaviorProfile();
    var visitorId = readStoredValue("localStorage", visitorIdStorageKey);
    var sessionId =
      readStoredValue("sessionStorage", sessionIdStorageKey) ||
      readStoredValue("sessionStorage", behaviorSessionStorageKey);
    var lastSeenCampaignId = readStoredValue(
      "localStorage",
      lastSeenCampaignIdStorageKey,
    );
    var lastPromoTouch = Number(
      readStoredValue("localStorage", lastPromoTouchStorageKey),
    );

    appendUnique(profile.sawCampaignIds, lastSeenCampaignId);
    readAppliedDiscountCampaignIds().forEach(function (campaignId) {
      appendUnique(profile.usedUniqueCodeCampaignIds, campaignId);
    });

    if (lastSeenCampaignId && Number.isFinite(lastPromoTouch)) {
      profile.totalTouches = Math.max(profile.totalTouches, 1);
      if (!profile.lastSeenAt || lastPromoTouch > profile.lastSeenAt) {
        profile.lastSeenAt = lastPromoTouch;
      }
    }

    return {
      canUseBehaviorTargeting: Boolean(safeLocalStorage()),
      reason: "",
      visitorId: visitorId || null,
      sessionId: sessionId || null,
      generatedAt: Date.now(),
      firstSeenAt: profile.firstSeenAt,
      lastSeenAt: profile.lastSeenAt,
      totalTouches: profile.totalTouches,
      sessionCount: profile.sessionIds.length,
      priorSessionCount: Math.max(0, profile.sessionIds.length - 1),
      productViewCount: profile.productViewCount,
      latestProductViewedAt: profile.latestProductViewedAt,
      latestAddToCartAt: profile.latestAddToCartAt,
      latestCheckoutStartedAt: profile.latestCheckoutStartedAt,
      latestOrderAt: profile.latestOrderAt,
      intentEventTimes: profile.intentEventTimes,
      sawCampaignIds: profile.sawCampaignIds,
      clickedCampaignIds: profile.clickedCampaignIds,
      usedUniqueCodeCampaignIds: profile.usedUniqueCodeCampaignIds,
      assignedUniqueCodeCampaignIds: profile.assignedUniqueCodeCampaignIds,
    };
  }

  function readStoredBehaviorProfile() {
    var parsed = readJsonStorage("localStorage", behaviorProfileStorageKey);
    var stored = readPlainObject(parsed);

    return {
      firstSeenAt: readTimestamp(stored.firstSeenAt),
      lastSeenAt: readTimestamp(stored.lastSeenAt),
      totalTouches: readNonNegativeInteger(stored.totalTouches),
      sessionIds: readTargetingList(stored.sessionIds),
      sessionCount: readNonNegativeInteger(stored.sessionCount),
      productViewCount: readNonNegativeInteger(stored.productViewCount),
      latestProductViewedAt: readTimestamp(stored.latestProductViewedAt),
      latestAddToCartAt: readTimestamp(stored.latestAddToCartAt),
      latestCheckoutStartedAt: readTimestamp(stored.latestCheckoutStartedAt),
      latestOrderAt: readTimestamp(stored.latestOrderAt),
      intentEventTimes: readTimestampList(stored.intentEventTimes),
      sawCampaignIds: readTargetingList(stored.sawCampaignIds),
      clickedCampaignIds: readTargetingList(stored.clickedCampaignIds),
      usedUniqueCodeCampaignIds: readTargetingList(
        stored.usedUniqueCodeCampaignIds,
      ),
      assignedUniqueCodeCampaignIds: readTargetingList(
        stored.assignedUniqueCodeCampaignIds,
      ),
    };
  }

  function writeBehaviorProfile(profile) {
    var storage = safeLocalStorage();
    var payload;

    if (!storage) return;

    profile.intentEventTimes = profile.intentEventTimes
      .filter(function (time) {
        return Number.isFinite(time) && time > 0;
      })
      .slice(-maxIntentEvents);
    profile.sawCampaignIds = profile.sawCampaignIds.slice(-maxBehaviorIds);
    profile.clickedCampaignIds =
      profile.clickedCampaignIds.slice(-maxBehaviorIds);
    profile.usedUniqueCodeCampaignIds =
      profile.usedUniqueCodeCampaignIds.slice(-maxBehaviorIds);
    profile.assignedUniqueCodeCampaignIds =
      profile.assignedUniqueCodeCampaignIds.slice(-maxBehaviorIds);

    payload = {
      firstSeenAt: profile.firstSeenAt || null,
      lastSeenAt: profile.lastSeenAt || null,
      totalTouches: profile.totalTouches || 0,
      sessionIds: profile.sessionIds || [],
      sessionCount: profile.sessionIds ? profile.sessionIds.length : 0,
      productViewCount: profile.productViewCount || 0,
      latestProductViewedAt: profile.latestProductViewedAt || null,
      latestAddToCartAt: profile.latestAddToCartAt || null,
      latestCheckoutStartedAt: profile.latestCheckoutStartedAt || null,
      latestOrderAt: profile.latestOrderAt || null,
      intentEventTimes: profile.intentEventTimes || [],
      sawCampaignIds: profile.sawCampaignIds || [],
      clickedCampaignIds: profile.clickedCampaignIds || [],
      usedUniqueCodeCampaignIds: profile.usedUniqueCodeCampaignIds || [],
      assignedUniqueCodeCampaignIds:
        profile.assignedUniqueCodeCampaignIds || [],
    };

    try {
      storage.setItem(behaviorProfileStorageKey, JSON.stringify(payload));
    } catch {
      return;
    }
  }

  function readAppliedDiscountCampaignIds() {
    var storage = safeLocalStorage();
    var ids = [];

    if (!storage) return ids;

    try {
      Object.keys(storage).forEach(function (key) {
        var id;

        if (key.indexOf(appliedDiscountStoragePrefix) !== 0) return;

        id = key
          .slice(appliedDiscountStoragePrefix.length)
          .split("_")[0]
          .trim();
        if (id) ids.push(id);
      });
    } catch {
      return ids;
    }

    return ids;
  }

  function readJsonStorage(storageName, key) {
    var value = readStoredValue(storageName, key);

    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function appendIntentEvent(profile, time) {
    profile.intentEventTimes.push(time);
  }

  function appendUnique(list, value) {
    value = String(value || "").trim();
    if (!value || list.indexOf(value) !== -1) return;
    list.push(value);
  }

  function matchesCampaignSet(actualCampaignIds, targetCampaignIds) {
    if (targetCampaignIds.length === 0) return actualCampaignIds.length > 0;

    return targetCampaignIds.some(function (campaignId) {
      return actualCampaignIds.indexOf(campaignId) !== -1;
    });
  }

  function minutesBetween(from, to) {
    return (to - from) / 60000;
  }

  function daysBetween(from, to) {
    return (to - from) / 86400000;
  }

  function readTimestamp(value) {
    var number = Number(value);
    var parsed;

    if (Number.isFinite(number) && number > 0) return number;

    parsed = Date.parse(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  function readTimestampList(value) {
    if (!Array.isArray(value)) return [];

    return value.map(readTimestamp).filter(function (time) {
      return Number.isFinite(time) && time > 0;
    });
  }

  function readNonNegativeInteger(value) {
    var number = Number(value);

    return Number.isInteger(number) && number > 0 ? number : 0;
  }

  function readBoundedInteger(value, min, max, fallback) {
    var number = Number(value);

    if (!Number.isInteger(number)) return fallback;

    return Math.min(max, Math.max(min, number));
  }

  function readBoolean(value, fallback) {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;

    return fallback;
  }

  function readTargetingList(value) {
    if (Array.isArray(value)) {
      return value
        .map(function (item) {
          return String(item || "").trim();
        })
        .filter(Boolean);
    }

    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function readStorefrontConfigList(config, key) {
    return readStorefrontList(config && config[key]);
  }

  function matchesOptionalExactList(allowedValues, actualValue) {
    if (!allowedValues.length) return true;

    return allowedValues.some(function (allowedValue) {
      return (
        String(allowedValue).toLowerCase() ===
        String(actualValue || "").toLowerCase()
      );
    });
  }

  function matchesOptionalLocaleList(allowedValues, actualValue) {
    if (!allowedValues.length) return true;

    return allowedValues.some(function (allowedValue) {
      return normalizeLocale(allowedValue) === normalizeLocale(actualValue);
    });
  }

  function matchesOptionalIntersection(allowedValues, actualValues) {
    if (!allowedValues.length) return true;

    return matchesAny(allowedValues, actualValues);
  }

  function matchesAny(allowedValues, actualValues) {
    var actualSet = actualValues.reduce(function (set, actualValue) {
      var value = String(actualValue || "")
        .trim()
        .toLowerCase();
      if (value) set[value] = true;
      return set;
    }, {});

    return allowedValues.some(function (allowedValue) {
      return (
        actualSet[
          String(allowedValue || "")
            .trim()
            .toLowerCase()
        ] === true
      );
    });
  }

  function matchesOptionalPathContains(allowedValues, paths) {
    if (!allowedValues.length) return true;

    return matchesPathContains(allowedValues, paths);
  }

  function matchesPathContains(allowedValues, paths) {
    var pathCandidates = Array.isArray(paths) ? paths : [paths];

    if (!allowedValues.length || !pathCandidates.length) return false;

    return pathCandidates.some(function (path) {
      var normalizedPath;

      if (!path) return false;

      normalizedPath = normalizePathTarget(path);

      return allowedValues.some(function (allowedValue) {
        var normalizedTarget = normalizePathTarget(allowedValue);

        if (normalizedTarget.indexOf("page:") === 0) {
          return matchesStorefrontPageTarget(normalizedTarget, normalizedPath);
        }

        return normalizedPath.indexOf(normalizedTarget) !== -1;
      });
    });
  }

  function normalizePathTarget(value) {
    var trimmedValue = String(value || "").trim();
    var url;

    if (!trimmedValue) return "";
    if (/^page:[a-z]+$/i.test(trimmedValue)) {
      return trimmedValue.toLowerCase();
    }

    try {
      url = new URL(trimmedValue);
      return (url.pathname + url.search).toLowerCase();
    } catch {
      return trimmedValue.toLowerCase();
    }
  }

  function matchesStorefrontPageTarget(target, normalizedPath) {
    var pathname = normalizedPath.split("?")[0].replace(/\/+$/, "") || "/";

    if (target === "page:home") return pathname === "/";
    if (target === "page:product") {
      return (
        pathname.indexOf("/products/") === 0 ||
        /^\/collections\/[^/]+\/products\//.test(pathname)
      );
    }
    if (target === "page:collection") {
      return /^\/collections\/[^/]+$/.test(pathname);
    }
    if (target === "page:collections") return pathname === "/collections";
    if (target === "page:page") return pathname.indexOf("/pages/") === 0;
    if (target === "page:cart") return pathname === "/cart";
    if (target === "page:search") return pathname === "/search";
    if (target === "page:blog") return pathname.indexOf("/blogs/") === 0;

    return false;
  }

  function normalizeCampaigns(campaigns) {
    return campaigns.map(normalizeCampaign);
  }

  function normalizeCampaign(campaign) {
    if (!campaign || typeof campaign !== "object") return campaign;

    return Object.assign({}, campaign, {
      design: normalizeCampaignDesign(campaign.design),
    });
  }

  function normalizeCampaignDesign(design) {
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

  function readPlacementList(value) {
    return String(value || "")
      .split(",")
      .map(function (placement) {
        return placement.trim().toUpperCase();
      })
      .filter(Boolean);
  }

  function appendStorefrontTrackingParams(params) {
    var tracking =
      typeof window.PromoPulseGetVisitorSessionTracking === "function"
        ? window.PromoPulseGetVisitorSessionTracking()
        : readLocalVisitorSessionTracking();

    if (!tracking) return;
    if (tracking.visitorId) params.set("visitorId", tracking.visitorId);
    if (tracking.sessionId) params.set("sessionId", tracking.sessionId);
    params.set("doNotTrack", tracking.doNotTrack ? "true" : "false");
  }

  function readLocalVisitorSessionTracking() {
    return {
      visitorId: readStoredValue("localStorage", visitorIdStorageKey),
      sessionId:
        readStoredValue("sessionStorage", sessionIdStorageKey) ||
        readStoredValue("sessionStorage", behaviorSessionStorageKey),
      doNotTrack: isDoNotTrackEnabled(),
    };
  }

  function assertStorefrontJsonResponse(response, url) {
    var contentType = response.headers.get("content-type") || "";
    var redirectedTo = response.redirected
      ? " Redirected to " + response.url
      : "";

    if (
      response.redirected ||
      response.url.indexOf("/password") !== -1 ||
      contentType.indexOf("application/json") === -1
    ) {
      pauseRequests("PromoPulseProxyPausedUntil", 60000);
      throw new Error(
        "Expected JSON from app proxy but received " +
          (contentType || "unknown content-type") +
          "." +
          redirectedTo +
          " Check Shopify app_proxy config for " +
          url +
          ".",
      );
    }
  }

  function readStorefrontConfigValue(config, key) {
    var value = config && config[key];

    return typeof value === "string" ? value : "";
  }

  function readStorefrontList(value) {
    if (Array.isArray(value)) {
      return value
        .map(function (item) {
          return String(item || "").trim();
        })
        .filter(Boolean);
    }

    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function detectDevice() {
    if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
    if (window.matchMedia("(max-width: 1024px)").matches) return "tablet";

    return "desktop";
  }

  function detectShop(root) {
    return (
      (root && root.dataset.shop) ||
      (window.Shopify && window.Shopify.shop) ||
      window.location.hostname
    );
  }

  function detectMarket() {
    var market = window.Shopify && window.Shopify.market;

    return (market && (market.handle || market.id || market)) || "";
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

  function normalizeMarketId(value) {
    return readString(value).toUpperCase();
  }

  function normalizeCountry(value) {
    return readString(value).toUpperCase().slice(0, 2);
  }

  function normalizeCurrency(value) {
    var currency = readString(value).toUpperCase();

    return /^[A-Z]{3}$/.test(currency) ? currency : "";
  }

  function normalizeLocale(value) {
    return readString(value).replace("_", "-").toLowerCase();
  }

  function formatAmount(value) {
    var number = Number(value);

    return Number.isFinite(number) ? number.toFixed(2) : String(value || "");
  }

  function readPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function readString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function safeLocalStorage() {
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
  }

  function safeSessionStorage() {
    try {
      return window.sessionStorage || null;
    } catch {
      return null;
    }
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
    } catch {
      return;
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

  function isDoNotTrackEnabled() {
    return (
      window.navigator.doNotTrack === "1" ||
      window.navigator.doNotTrack === "yes" ||
      window.doNotTrack === "1"
    );
  }

  function getRoot() {
    return (
      document.getElementById("promo-pulse-app-embed") ||
      document.querySelector(".pp-root")
    );
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

  function clonePlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.assign({}, value)
      : value;
  }

  function debug(root, error) {
    if (
      ((root && root.dataset.debug === "true") ||
        (window.PromoPulseSettings || {}).enableDebugMode === true) &&
      window.console
    ) {
      window.console.log("[PromoPulse loader]", error);
    }
  }

  function pauseRequests(key, ms) {
    window[key] = Math.max(Number(window[key] || 0), Date.now() + ms);
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
})();
