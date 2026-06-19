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
      cartSubtotal:
        typeof window.CounterPulseCartSubtotal === "number"
          ? window.CounterPulseCartSubtotal
          : null,
      currency: root.dataset.cartCurrency || detectCurrency(),
      campaignId: root.dataset.campaignId || "",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      alignment: root.dataset.alignment || "CENTER",
      compactMode: root.dataset.compact === "true",
      showIcon: root.dataset.showIcon !== "false",
      debugMode: root.dataset.debug === "true",
      apiBaseUrl:
        root.dataset.apiBaseUrl || window.CounterPulseApiBaseUrl || "",
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

    fetch(requestUrl, {
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
        var campaign = campaigns[0] || null;
        if (campaign) {
          updateDebug(
            root,
            "API OK: se recibio la campana " +
              campaign.id +
              " (" +
              campaign.type +
              ").",
            requestUrl,
          );
          render(root, campaign, config);
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
    if (config.productTags.length)
      params.set("productTags", config.productTags.join(","));
    if (config.cartSubtotal !== null)
      params.set("cartSubtotal", String(config.cartSubtotal));
    if (config.currency) params.set("currency", config.currency);
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

  function render(root, campaign, config) {
    var design = campaign.design || {};
    var timerState;
    var card = document.createElement("section");

    if (campaign.type === "DELIVERY_CUTOFF" || campaign.type === "LOW_STOCK") {
      updateDebug(
        root,
        "Campana recibida, pero " +
          campaign.type +
          " la renderiza un asset dedicado en este mismo bloque.",
      );
      return;
    }

    timerState = calculateTimerState(campaign, new Date());
    if (timerState.isExpired && !(campaign.texts || {}).expiredText) {
      updateDebug(
        root,
        "Campana recibida, pero esta expirada y no tiene expiredText para mostrar.",
      );
      return;
    }

    card.className =
      "pp-product-card" +
      (config.compactMode ? " pp-product-card--compact" : "");
    card.dataset.campaignId = campaign.id;
    card.setAttribute("role", "region");
    card.setAttribute(
      "aria-label",
      ((campaign.texts || {}).headline || "Limited-time offer").trim(),
    );
    setDesign(card, design, config.alignment);

    if (
      config.showIcon &&
      design.showIcon !== false &&
      design.icon !== "NONE"
    ) {
      card.appendChild(node("span", "pp-icon", iconLabel(design.icon)));
    }

    card.appendChild(renderMessage(campaign, timerState, config));

    if (campaign.type === "FREE_SHIPPING_GOAL") {
      card.appendChild(renderFreeShippingProgress(campaign, config));
    }

    if (
      !timerState.isExpired &&
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode)
    ) {
      card.appendChild(
        window.CounterPulseCouponButton(
          campaign.discount.discountCode,
          campaign,
        ),
      );
    }

    if (!timerState.isExpired && (campaign.texts || {}).ctaText) {
      card.appendChild(
        renderCta(campaign.texts.ctaText, campaign.texts.ctaUrl),
      );
    }

    root.replaceChildren(card);
    tick(card, campaign);
    emitImpression(campaign);
  }

  function applyExperiment(campaign) {
    if (window.CounterPulseApplyExperiment) {
      return window.CounterPulseApplyExperiment(campaign);
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

  function renderMessage(campaign, timerState, config) {
    var texts = campaign.texts || {};
    var message = document.createElement("div");
    var headline = texts.headline || "Limited-time offer";
    var detail = texts.subheadline || "";

    message.className = "pp-message";

    if (campaign.type === "FREE_SHIPPING_GOAL") {
      detail = buildFreeShippingText(campaign, config) || detail;
    }

    if (timerState.isExpired && texts.expiredText) {
      detail = texts.expiredText;
    }

    message.appendChild(node("strong", "", headline));
    if (detail) message.appendChild(node("span", "", detail));
    if (timerState.isActive) {
      message.appendChild(renderCountdown(timerState.remainingMs));
    }

    return message;
  }

  function renderCta(text, url) {
    var cta = node("a", "pp-cta", text);
    cta.href =
      url && (url.charAt(0) === "/" || /^https?:\/\//i.test(url)) ? url : "#";
    cta.setAttribute("aria-label", text);
    return cta;
  }

  function renderFreeShippingProgress(campaign, config) {
    var progress = calculateFreeShippingProgress(campaign, config);
    var wrapper = document.createElement("div");
    var track = document.createElement("span");
    var fill = document.createElement("span");

    wrapper.className = "pp-progress";
    track.className = "pp-progress__track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", buildFreeShippingText(campaign, config));
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute(
      "aria-valuenow",
      String(Math.round(progress.percentage)),
    );
    fill.className = "pp-progress__fill";
    fill.style.width = progress.percentage + "%";
    track.appendChild(fill);
    wrapper.appendChild(track);

    return wrapper;
  }

  function renderCountdown(ms) {
    var countdown = node("span", "pp-countdown", formatTime(ms));

    countdown.setAttribute("aria-live", "polite");
    countdown.setAttribute("aria-label", "Time remaining");

    return countdown;
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
        "You're {{amount}} away from free shipping";
    } else if (progress.unlocked) {
      return (
        texts.freeShippingSuccessText ||
        settings.successMessage ||
        "You've unlocked free shipping!"
      );
    } else {
      template =
        texts.freeShippingProgressText ||
        "You're {{amount}} away from free shipping";
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
    if (!card.querySelector(".pp-countdown")) return;

    window.setInterval(function () {
      var state = calculateTimerState(campaign, new Date());
      var countdown = card.querySelector(".pp-countdown");

      if (!countdown) return;
      if (state.isExpired) {
        countdown.remove();
        card.classList.add("pp-bar--expired");
        return;
      }

      countdown.textContent = formatTime(state.remainingMs);
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
    var storage =
      timer.resetBehavior === "ON_SESSION_END" ? sessionStorage : localStorage;
    var key = "counterpulse_product_deadline_" + id;
    var stored = parseDate(storage.getItem(key));
    var duration = Number(timer.durationMinutes);
    var endsAt;

    if (stored && stored.getTime() > Date.now()) return stored;

    endsAt = new Date(Date.now() + Math.round(duration) * 60000);
    try {
      storage.setItem(key, endsAt.toISOString());
    } catch {
      return endsAt;
    }

    return endsAt;
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
      "--pp-button",
      color(design.buttonColor, "#ffffff"),
    );
    element.style.setProperty(
      "--pp-button-text",
      color(design.buttonTextColor, "#111827"),
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

  function formatTime(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    return days > 0
      ? days + "d " + pad(hours) + "h " + pad(minutes) + "m"
      : pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
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

  function splitList(value) {
    return (value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
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
      window.CounterPulseCartCurrency ||
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
      ""
    );
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

  function justify(alignment) {
    if (alignment === "LEFT") return "flex-start";
    if (alignment === "RIGHT") return "flex-end";
    return "center";
  }

  function textAlign(alignment) {
    if (alignment === "LEFT") return "left";
    if (alignment === "RIGHT") return "right";
    return "center";
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function applyStorefrontSettings(config, settings) {
    if (!settings || typeof settings !== "object") return;

    window.CounterPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;
    config.currency = config.currency || settings.defaultCurrency || "";
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
