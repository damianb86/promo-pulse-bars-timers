(function () {
  "use strict";

  var blocks = [].slice.call(document.querySelectorAll(".pp-product-timer"));

  blocks.forEach(initBlock);

  function initBlock(root) {
    var config = {
      shop: root.dataset.shop || (window.Shopify && window.Shopify.shop) || "",
      locale: root.dataset.locale || document.documentElement.lang || "en",
      country: root.dataset.country || "",
      market: root.dataset.market || detectMarket(),
      productId: root.dataset.productId || "",
      productTags: splitList(root.dataset.productTags),
      device: detectDevice(),
      cartSubtotal:
        typeof window.PromoPulseCartSubtotal === "number"
          ? window.PromoPulseCartSubtotal
          : null,
      currency: root.dataset.cartCurrency || detectCurrency(),
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      alignment: root.dataset.alignment || "CENTER",
      compactMode: root.dataset.compact === "true",
      debugMode: root.dataset.debug === "true",
      apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };
    var requestUrl;

    if (!config.shop) {
      updateDebug(root, "Detenido: falta el shop domain en el bloque.");
      return;
    }
    if (!config.productId) {
      updateDebug(
        root,
        "Detenido: Shopify no expuso productId. Coloca el bloque en un template de producto.",
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

    requestUrl = buildUrl(config);
    updateDebug(
      root,
      "Consultando campanas PRODUCT_PAGE elegibles.",
      requestUrl,
    );

    fetchCampaigns(config, requestUrl)
      .then(function (response) {
        var campaigns = Array.isArray(response.campaigns)
          ? response.campaigns
          : [];
        if (campaigns.length > 0) {
          updateDebug(
            root,
            "API OK: se recibieron " +
              campaigns.length +
              " campana(s) elegibles.",
            requestUrl,
          );
          renderCampaigns(root, campaigns, config);
        } else {
          updateDebug(
            root,
            "API OK: 0 campanas elegibles. Revisa status ACTIVE, placement PRODUCT_PAGE, targeting, locale/country/producto y fechas.",
            requestUrl,
          );
        }
      })
      .catch(function (error) {
        updateDebug(
          root,
          "Error consultando la API: " + error.message,
          requestUrl,
        );
        if (config.debugMode && window.console)
          console.log("[CP product]", error);
      });
  }

  function fetchCampaigns(config, fallbackUrl) {
    var campaignId =
      config.fallbackMode === "SPECIFIC_CAMPAIGN" ? config.campaignId : "";

    if (window.PromoPulseFetchCampaigns) {
      return window
        .PromoPulseFetchCampaigns(config, "PRODUCT_PAGE", {
          campaignId: campaignId,
        })
        .then(function (payload) {
          applyStorefrontSettings(config, payload.settings);
          return {
            campaigns: Array.isArray(payload.campaigns)
              ? payload.campaigns.map(applyExperiment)
              : [],
          };
        });
    }

    return fetch(fallbackUrl, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(config, payload.settings);
        return {
          campaigns: Array.isArray(payload.campaigns)
            ? payload.campaigns.map(applyExperiment)
            : [],
        };
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
    if (config.productTags.length)
      params.set("productTags", config.productTags.join(","));
    if (config.currency) params.set("currency", config.currency);
    appendBehaviorTargetingParams(params);
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && config.campaignId) {
      params.set("campaignId", config.campaignId);
    }

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

  // Each dedicated product-page asset (timer, low-stock, delivery-cutoff)
  // shares the same .pp-product-timer block. They must render into their own
  // slot so they don't clobber each other when several campaigns target the
  // PRODUCT_PAGE placement at once.
  function getRenderSlot(root, name) {
    var selector = '[data-pp-slot="' + name + '"]';
    var slot = root.querySelector(selector);
    if (!slot) {
      slot = document.createElement("div");
      slot.setAttribute("data-pp-slot", name);
      slot.className = "pp-render-slot pp-render-slot--" + name;
      root.appendChild(slot);
    }
    return slot;
  }

  function renderCampaigns(root, campaigns, config) {
    var slot = getRenderSlot(root, "timer");
    var cards = [];
    var ticks = [];

    campaigns.forEach(function (campaign) {
      var card = buildCampaignCard(root, campaign, config);
      if (card) {
        cards.push(card);
        ticks.push({ card: card, campaign: campaign });
      }
    });

    if (cards.length === 0) {
      slot.replaceChildren();
      return;
    }

    stopProductTimers(slot);
    slot.replaceChildren.apply(slot, cards);

    ticks.forEach(function (entry) {
      tick(entry.card, entry.campaign);
      emitImpression(entry.campaign);
    });
  }

  function buildCampaignCard(root, campaign, config) {
    var design = campaign.design || {};
    var texts = campaign.texts || {};
    var isFullWidth = design.fullWidth === true;
    var timerState;

    if (campaign.type === "DELIVERY_CUTOFF" || campaign.type === "LOW_STOCK") {
      updateDebug(
        root,
        "Campana recibida, pero " +
          campaign.type +
          " la renderiza un asset dedicado en este mismo bloque.",
      );
      return null;
    }

    timerState = calculateTimerState(campaign, new Date());
    if (timerState.isExpired && shouldHideExpiredCampaign(campaign)) {
      updateDebug(
        root,
        "Campana recibida, pero el timer expiro y debe ocultarse.",
      );
      return null;
    }

    if (
      design.dismissBehavior === "HIDE_PERMANENTLY" &&
      isCampaignDismissed(campaign.id)
    ) {
      updateDebug(
        root,
        "Campana cerrada por el visitante; no se vuelve a mostrar.",
      );
      return null;
    }

    if (!window.CountPulseSurface) {
      updateDebug(root, "Surface module no disponible todavia.");
      return null;
    }

    var detail = texts.subheadline || "";
    if (campaign.type === "FREE_SHIPPING_GOAL") {
      detail = buildFreeShippingText(campaign, config) || detail;
    }
    if (timerState.isExpired && texts.expiredText) {
      detail = texts.expiredText;
    }

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

    var progress = null;
    var variables = {};
    if (campaign.type === "FREE_SHIPPING_GOAL") {
      var fs = calculateFreeShippingProgress(campaign, config);
      var amount = money(
        fs.amountRemaining,
        (campaign.freeShipping || {}).currencyCode || config.currency,
      );
      variables = {
        amount: amount,
        remaining: amount,
        remaining_amount: amount,
      };
      if (design.showProgressBar !== false) {
        progress = {
          percentage: fs.percentage,
          style: readProgressStyle(campaign),
          unlocked: fs.unlocked,
        };
      }
    }

    var card = window.CountPulseSurface.build({
      variant: "block",
      placement: campaign.placement || "PRODUCT_PAGE",
      design: design,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: config.locale,
      variables: variables,
      headline: texts.headline || "Limited-time offer",
      body: detail,
      timer: {
        isActive: timerState.isActive,
        isExpired: timerState.isExpired,
        remainingMs: timerState.remainingMs,
      },
      hasTimer: timerState.isActive,
      couponNode: couponNode,
      cta:
        !timerState.isExpired && design.showButton !== false
          ? texts.ctaText || ""
          : "",
      ctaUrl: texts.ctaUrl || "",
      progress: progress,
      dataTestId: "product-timer-widget",
      onClose: function () {
        if (design.dismissBehavior === "HIDE_PERMANENTLY") {
          rememberCampaignDismissed(campaign.id);
        }
        removeProductCard(card, design);
      },
    });

    card.dataset.campaignId = campaign.id;
    if (config.compactMode) {
      card.classList.add("counterpulse-preview-promo--compact");
    }
    applyProductBlockWidth(root, isFullWidth);

    return card;
  }

  function applyProductBlockWidth(root, isFullWidth) {
    var block = root && root.closest ? root.closest(".shopify-block") : null;

    if (root && root.classList) {
      root.classList.toggle("pp-product-timer--full-width", isFullWidth);
    }

    if (!block) return;

    if (isFullWidth) {
      // Product-page (and other non-bar) placements fill their container, not
      // the viewport. Only TOP_BAR / BOTTOM_BAR break out to 100vw.
      block.dataset.ppProductTimerFullWidth = "true";
      block.style.setProperty("width", "100%");
      block.style.setProperty("max-width", "100%");
      block.style.removeProperty("margin-left");
      block.style.removeProperty("margin-right");
      return;
    }

    if (block.dataset.ppProductTimerFullWidth !== "true") return;

    delete block.dataset.ppProductTimerFullWidth;
    block.style.removeProperty("width");
    block.style.removeProperty("max-width");
    block.style.removeProperty("margin-left");
    block.style.removeProperty("margin-right");
  }

  function stopProductTimers(root) {
    if (!root || !root.querySelectorAll) return;

    [].slice
      .call(
        root.querySelectorAll(".pp-product-card, .counterpulse-preview-promo"),
      )
      .forEach(function (card) {
        if (card.__promoPulseTimerInterval) {
          window.clearInterval(card.__promoPulseTimerInterval);
          card.__promoPulseTimerInterval = null;
        }
      });
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
    }

    return campaign;
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

  function dismissStorageKey(campaignId) {
    return "promo_pulse_dismissed_" + campaignId;
  }

  function isCampaignDismissed(campaignId) {
    if (!campaignId) return false;

    try {
      return window.localStorage.getItem(dismissStorageKey(campaignId)) === "1";
    } catch (error) {
      return false;
    }
  }

  function rememberCampaignDismissed(campaignId) {
    if (!campaignId) return;

    try {
      window.localStorage.setItem(dismissStorageKey(campaignId), "1");
    } catch (error) {
      /* storage blocked: dismissal cannot persist */
    }
  }

  function removeProductCard(card, design) {
    var duration = clamp((design || {}).animationDurationMs, 0, 1500, 220);

    if (
      !(design || {}).exitAnimation ||
      (design || {}).exitAnimation === "NONE" ||
      duration === 0
    ) {
      stopSingleProductTimer(card);
      card.remove();
      return;
    }

    card.classList.add("pp-bar--closing");
    window.setTimeout(function () {
      stopSingleProductTimer(card);
      card.remove();
    }, duration);
  }

  function stopSingleProductTimer(card) {
    if (card && card.__promoPulseTimerInterval) {
      window.clearInterval(card.__promoPulseTimerInterval);
      card.__promoPulseTimerInterval = null;
    }
  }

  function readProgressStyle(campaign) {
    var style = String(
      (campaign.freeShipping || {}).progressStyle || "BAR",
    ).toUpperCase();

    return style === "COMPACT" || style === "CIRCULAR" ? style : "BAR";
  }

  function getExpiredBehavior(campaign) {
    return (campaign.timer || {}).expiredBehavior || "UNPUBLISH_TIMER";
  }

  function shouldHideExpiredCampaign(campaign) {
    var behavior = getExpiredBehavior(campaign);
    return behavior === "UNPUBLISH_TIMER" || behavior === "HIDE_TIMER";
  }

  function buildFreeShippingText(campaign, config) {
    var texts = campaign.texts || {};
    var settings = campaign.freeShipping || {};
    var progress = calculateFreeShippingProgress(campaign, config);
    var amount = money(
      progress.amountRemaining,
      settings.currencyCode || config.currency,
    );
    var template;

    if (progress.cartSubtotal <= 0) {
      template =
        texts.freeShippingEmptyText ||
        settings.emptyCartMessage ||
        texts.freeShippingProgressText ||
        "You're {{remaining_amount}} away from free shipping";
    } else if (progress.unlocked) {
      return (
        texts.freeShippingSuccessText ||
        settings.successMessage ||
        "You've unlocked free shipping!"
      );
    } else {
      template =
        texts.freeShippingProgressText ||
        "You're {{remaining_amount}} away from free shipping";
    }

    return template
      .replace(/\{\{\s*amount\s*\}\}/g, amount)
      .replace(/\{\{\s*remaining\s*\}\}/g, amount)
      .replace(/\{\{\s*remaining_amount\s*\}\}/g, amount);
  }

  function calculateFreeShippingProgress(campaign, config) {
    var threshold = Number((campaign.freeShipping || {}).thresholdAmount || 0);
    var subtotal = Number(config.cartSubtotal || 0);
    var unlocked = threshold <= 0 || subtotal >= threshold;
    var remaining = unlocked ? 0 : Math.max(0, threshold - subtotal);

    return {
      amountRemaining: Math.round(remaining * 100) / 100,
      cartSubtotal: subtotal,
      percentage:
        threshold <= 0
          ? 100
          : Math.min(100, Math.max(0, (subtotal / threshold) * 100)),
      unlocked: unlocked,
    };
  }

  function tick(card, campaign) {
    if (!card.querySelector("[data-cp-timer]")) return;

    card.__promoPulseTimerInterval = window.setInterval(function () {
      var state = calculateTimerState(campaign, new Date());
      var countdowns = card.querySelectorAll("[data-cp-timer]");
      var countdown = countdowns[0];
      var subheadline = card.querySelector(
        ".counterpulse-preview-message-copy > span",
      );
      var expiredBehavior = getExpiredBehavior(campaign);
      var expiredText = (campaign.texts || {}).expiredText || "";

      if (!countdown) return;
      if (state.isExpired) {
        Array.prototype.forEach.call(countdowns, function (node) {
          node.remove();
        });
        card.classList.add("counterpulse-preview-promo--expired");
        if (expiredBehavior === "SHOW_CUSTOM_TITLE" && expiredText) {
          if (subheadline) subheadline.textContent = expiredText;
        } else if (
          expiredBehavior === "HIDE_TIMER" ||
          expiredBehavior === "UNPUBLISH_TIMER"
        ) {
          stopSingleProductTimer(card);
          card.remove();
        }
        return;
      }

      Array.prototype.forEach.call(countdowns, function (node) {
        window.CountPulseSurface.updateTimer(
          node,
          state.remainingMs,
          campaign.design || {},
        );
      });
    }, 1000);
  }

  function calculateTimerState(campaign, now) {
    var timer = campaign.timer || {};
    var mode = timer.mode || "FIXED_DATE";
    var endsAt;

    if (mode === "EVERGREEN_SESSION" && timer.durationMinutes) {
      endsAt = evergreenDeadline(campaign.id, timer);
      return timerState(now, endsAt);
    }

    if (mode === "RECURRING_DAILY") {
      endsAt = dailyDeadline(timer, campaign.timezone, now);
      return timerState(now, endsAt);
    }

    if (mode === "RECURRING_WEEKLY") {
      endsAt = weeklyDeadline(timer, campaign.timezone, now);
      return timerState(now, endsAt);
    }

    return timerState(now, parseDate(campaign.endsAt));
  }

  function evergreenDeadline(id, timer) {
    var storage = safeStorage(
      timer.resetBehavior === "ON_SESSION_END"
        ? "sessionStorage"
        : "localStorage",
    );
    var key = "promo_pulse_product_deadline_" + id;
    var stored = storage ? parseDate(storage.getItem(key)) : null;
    var duration = Number(timer.durationMinutes);
    var endsAt;

    if (stored) {
      if (stored.getTime() > Date.now()) return stored;
      if (timer.expiredBehavior !== "REPEAT_COUNTDOWN") return stored;
    }

    endsAt = new Date(Date.now() + Math.round(duration) * 60000);
    try {
      storage.setItem(key, endsAt.toISOString());
    } catch {
      return endsAt;
    }

    return endsAt;
  }

  function safeStorage(storageName) {
    try {
      return window[storageName] || null;
    } catch {
      return null;
    }
  }

  function dailyDeadline(settings, timezone, now) {
    var hour = numberOrNull(settings.cutoffHour);
    var minute = numberOrNull(settings.cutoffMinute) || 0;
    var parts;

    if (hour === null) return null;

    parts = zonedParts(now, timezone);
    return zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      hour,
      minute,
      timezone,
    );
  }

  function weeklyDeadline(timer, timezone, now) {
    var rules = Array.isArray(timer.recurringDays) ? timer.recurringDays : [];
    var parts = zonedParts(now, timezone);
    var candidates = rules
      .map(function (rule) {
        var weekday = weekdayNumber(rule.weekday || rule.day);
        var hour = numberOrNull(rule.cutoffHour ?? rule.hour);
        var minute = numberOrNull(rule.cutoffMinute ?? rule.minute) || 0;
        var daysUntil;
        var candidateParts;

        if (!weekday || hour === null) return null;

        daysUntil = (weekday - parts.isoWeekday + 7) % 7;
        candidateParts = zonedParts(
          new Date(
            zonedTimeToUtc(
              parts.year,
              parts.month,
              parts.day,
              0,
              0,
              timezone,
            ).getTime() +
              daysUntil * 86400000,
          ),
          timezone,
        );

        return zonedTimeToUtc(
          candidateParts.year,
          candidateParts.month,
          candidateParts.day,
          hour,
          minute,
          timezone,
        );
      })
      .filter(function (date) {
        return date && date.getTime() > now.getTime();
      })
      .sort(function (first, second) {
        return first.getTime() - second.getTime();
      });

    return candidates[0] || null;
  }

  function timerState(now, endsAt) {
    var expired = endsAt ? endsAt.getTime() <= now.getTime() : false;
    var remainingMs = endsAt
      ? Math.max(0, endsAt.getTime() - now.getTime())
      : 0;

    return {
      isActive: Boolean(endsAt && !expired),
      isExpired: expired,
      remainingMs: remainingMs,
    };
  }

  function zonedParts(date, timezone) {
    var parts = {};
    var weekdays = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

    new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimezone(timezone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(date)
      .forEach(function (part) {
        parts[part.type] = part.value;
      });

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
      isoWeekday: weekdays[parts.weekday] || 1,
    };
  }

  function zonedTimeToUtc(year, month, day, hour, minute, timezone) {
    var local = Date.UTC(year, month - 1, day, hour, minute, 0);
    var utc = local;

    for (var index = 0; index < 3; index += 1) {
      utc = local - (zonedTimestamp(new Date(utc), timezone) - utc);
    }

    return new Date(utc);
  }

  function zonedTimestamp(date, timezone) {
    var parts = zonedParts(date, timezone);
    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
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

  function splitList(value) {
    return (value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        currency: currency || "USD",
        style: "currency",
      }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  }

  function numberOrNull(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function weekdayNumber(value) {
    var weekdays = {
      mon: 1,
      monday: 1,
      tue: 2,
      tuesday: 2,
      wed: 3,
      wednesday: 3,
      thu: 4,
      thursday: 4,
      fri: 5,
      friday: 5,
      sat: 6,
      saturday: 6,
      sun: 7,
      sunday: 7,
    };
    var normalized;

    if (typeof value === "number") return value === 0 ? 7 : value;
    if (typeof value !== "string") return null;

    normalized = value.trim().toLowerCase();
    return weekdays[normalized] || null;
  }

  function safeTimezone(timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return timezone;
    } catch {
      return "UTC";
    }
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

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, Math.round(number)))
      : fallback;
  }

  function applyStorefrontSettings(config, settings) {
    if (!settings || typeof settings !== "object") return;

    window.PromoPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;
    config.currency = config.currency || settings.defaultCurrency || "";
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
