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
      apiBaseUrl:
        root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
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
      device: config.device,
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
    if (timerState.isExpired && shouldHideExpiredCampaign(campaign)) {
      updateDebug(
        root,
        "Campana recibida, pero el timer expiro y debe ocultarse.",
      );
      return;
    }

    card.className =
      "pp-product-card" +
      (config.compactMode ? " pp-product-card--compact" : "");
    applyMotionClasses(card, design);
    card.dataset.campaignId = campaign.id;
    card.setAttribute("role", "region");
    card.setAttribute(
      "aria-label",
      ((campaign.texts || {}).headline || "Limited-time offer").trim(),
    );
    setDesign(card, design, config.alignment);

    var icon = renderDesignIcon(design);
    if (icon) card.appendChild(icon);

    card.appendChild(renderMessage(campaign, timerState, config));

    if (campaign.type === "FREE_SHIPPING_GOAL") {
      card.appendChild(renderFreeShippingProgress(campaign, config));
    }

    if (
      !timerState.isExpired &&
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.PromoPulseCouponButton === "function"
    ) {
      card.appendChild(
        window.PromoPulseCouponButton(
          campaign.discount.discountCode,
          campaign,
        ),
      );
    }

    if (
      !timerState.isExpired &&
      design.showButton !== false &&
      (campaign.texts || {}).ctaText
    ) {
      card.appendChild(
        renderCta(campaign.texts.ctaText, campaign.texts.ctaUrl),
      );
    }

    root.replaceChildren(card);
    tick(card, campaign);
    emitImpression(campaign);
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
      message.appendChild(
        renderCountdown(timerState.remainingMs, campaign.design || {}),
      );
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

    wrapper.className = progressClassName("pp-progress", campaign);
    if (progress.unlocked) wrapper.classList.add("is-unlocked");
    wrapper.style.setProperty("--pp-progress", progress.percentage + "%");
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

  function progressClassName(baseClass, campaign) {
    var style = readProgressStyle(campaign);

    return style === "BAR"
      ? baseClass
      : baseClass + " " + baseClass + "--" + style.toLowerCase();
  }

  function readProgressStyle(campaign) {
    var style = String(
      ((campaign.freeShipping || {}).progressStyle || "BAR"),
    ).toUpperCase();

    return style === "COMPACT" || style === "CIRCULAR" ? style : "BAR";
  }

  function renderCountdown(ms, design) {
    var countdown = node(
      "span",
      "pp-countdown" + timerTickClass(design),
      formatTime(ms, design),
    );

    countdown.setAttribute("aria-live", "polite");
    countdown.setAttribute("aria-label", "Time remaining");

    return countdown;
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
      var subheadline = card.querySelector(
        ".pp-message span:not(.pp-countdown)",
      );
      var expiredBehavior = getExpiredBehavior(campaign);
      var expiredText = (campaign.texts || {}).expiredText || "";

      if (!countdown) return;
      if (state.isExpired) {
        countdown.remove();
        card.classList.add("pp-bar--expired");
        if (expiredBehavior === "SHOW_CUSTOM_TITLE" && expiredText) {
          if (subheadline) subheadline.textContent = expiredText;
        } else if (
          expiredBehavior === "HIDE_TIMER" ||
          expiredBehavior === "UNPUBLISH_TIMER"
        ) {
          card.remove();
        }
        return;
      }

      var nextText = formatTime(state.remainingMs, campaign.design || {});
      if (countdown.textContent !== nextText) {
        countdown.textContent = nextText;
        replayCountdownTick(countdown);
      }
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

  function setDesign(element, design, alignment) {
    element.style.setProperty("--pp-bg", getBackground(design));
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
    element.style.setProperty(
      "--pp-motion-duration",
      clamp(design.animationDurationMs, 0, 1500, 220) + "ms",
    );
  }

  function applyMotionClasses(element, design) {
    if (design.entranceAnimation && design.entranceAnimation !== "NONE") {
      element.classList.add(
        "pp-surface--enter-" + String(design.entranceAnimation).toLowerCase(),
      );
    }
  }

  function timerTickClass(design) {
    return design.timerTickAnimation && design.timerTickAnimation !== "NONE"
      ? " pp-countdown--tick-" + String(design.timerTickAnimation).toLowerCase()
      : "";
  }

  function replayCountdownTick(countdown) {
    if (
      !countdown ||
      !/\bpp-countdown--tick-(fade|flip|pulse)\b/.test(countdown.className)
    ) {
      return;
    }

    countdown.classList.remove("pp-countdown--ticking");
    void countdown.offsetWidth;
    countdown.classList.add("pp-countdown--ticking");
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

  function formatTime(ms, design) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var showDays = !design || design.timerHideZeroDays === false || days > 0;
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var units;

    if (design && design.timerFormat === "UNITS") {
      units = [];
      if (showDays) {
        units.push(
          formatTimerUnit(days, timerUnitLabel(design, "days"), design),
        );
      }
      units.push(
        formatTimerUnit(
          showDays ? hours : Math.floor(totalSeconds / 3600),
          timerUnitLabel(design, "hours"),
          design,
        ),
      );
      units.push(
        formatTimerUnit(minutes, timerUnitLabel(design, "minutes"), design),
      );
      if (!design || design.timerShowSeconds !== false) {
        units.push(
          formatTimerUnit(seconds, timerUnitLabel(design, "seconds"), design),
        );
      }
      return units.join(" ");
    }

    if (design && design.timerShowSeconds === false) {
      return showDays
        ? [pad(days), pad(hours), pad(minutes)].join(":")
        : pad(hours) + ":" + pad(minutes);
    }

    return showDays
      ? [pad(days), pad(hours), pad(minutes), pad(seconds)].join(":")
      : pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  function formatTimerUnit(value, label, design) {
    if (design && design.timerShowLabels === false) return pad(value);
    return pad(value) + " " + label;
  }

  function timerUnitLabel(design, unit) {
    if (unit === "days") return design.timerDaysLabel || "Days";
    if (unit === "hours") return design.timerHoursLabel || "Hrs";
    if (unit === "minutes") return design.timerMinutesLabel || "Mins";
    return design.timerSecondsLabel || "Secs";
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

  function renderDesignIcon(design) {
    var icon = document.createElement("span");
    var image;
    var svg;

    if (!design || design.icon === "NONE") return null;

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

    window.PromoPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;
    config.currency = config.currency || settings.defaultCurrency || "";
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
