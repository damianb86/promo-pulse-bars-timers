(function () {
  "use strict";

  var root = document.getElementById("counterpulse-app-embed");
  if (!root) return;

  var config = {
    shop: detectShop(root),
    path: window.location.pathname,
    locale: detectLocale(root),
    country: detectCountry(root),
    market: detectMarket(root),
    currency: detectCurrency(root),
    device: detectDevice(),
    utmSource:
      new URLSearchParams(window.location.search).get("utm_source") || "",
    debugMode: root.dataset.debug === "true",
    apiPath: getCampaignsEndpoint(root.dataset.apiBaseUrl),
  };
  var campaignCache = {};
  var pendingFetches = {};
  var renderedCampaigns = {};
  var cacheTtlMs = 30000;

  if (!config.shop) {
    updateDebug(root, "Embed detenido: falta el shop domain.");
    return;
  }

  updateDebug(
    root,
    "Embed JS cargado. Consultando TOP_BAR y BOTTOM_BAR; cart drawer, free shipping y delivery cutoff los manejan assets dedicados.",
  );

  Promise.all(["TOP_BAR", "BOTTOM_BAR"].map(fetchCampaigns))
    .then(function (responses) {
      updateDebug(
        root,
        "API global OK: " +
          responses.flat().length +
          " campana(s) recibidas para TOP_BAR/BOTTOM_BAR.",
      );
      responses.flat().forEach(renderCampaign);
    })
    .catch(function (error) {
      updateDebug(root, "Error global del embed: " + error.message);
      debug(error);
    });

  function fetchCampaigns(placement) {
    var url = buildCampaignUrl(placement);
    var cached = campaignCache[url];
    var now = Date.now();

    updateDebug(root, "Consultando " + placement + ".", url);

    if (cached && cached.expiresAt > now) {
      updateDebug(
        root,
        "Usando cache local para " +
          placement +
          ": " +
          cached.campaigns.length +
          " campana(s).",
        url,
      );
      return Promise.resolve(cached.campaigns);
    }

    if (pendingFetches[url]) {
      return pendingFetches[url];
    }

    pendingFetches[url] = window
      .fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(response.status);
        }

        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(payload.settings);
        var campaigns = Array.isArray(payload.campaigns)
          ? payload.campaigns.map(applyExperiment)
          : [];
        campaignCache[url] = {
          campaigns: campaigns,
          expiresAt: Date.now() + cacheTtlMs,
        };
        updateDebug(
          root,
          "API OK para " + placement + ": " + campaigns.length + " campana(s).",
          url,
        );
        return campaigns;
      })
      .catch(function (error) {
        updateDebug(
          root,
          "Error consultando " + placement + ": " + error.message,
          url,
        );
        debug(placement, error);
        return [];
      })
      .finally(function () {
        delete pendingFetches[url];
      });

    return pendingFetches[url];
  }

  function buildCampaignUrl(placement) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: config.path,
      locale: config.locale,
      device: config.device,
      placement: placement,
    });
    var cartSubtotal = detectCartSubtotal();

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.utmSource) params.set("utmSource", config.utmSource);

    if (cartSubtotal !== null) {
      params.set("cartSubtotal", String(cartSubtotal));
    }

    return config.apiPath + "?" + params.toString();
  }

  function getCampaignsEndpoint(apiBaseUrl) {
    var value = (window.CounterPulseApiBaseUrl || apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/counterpulse-campaigns";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function renderCampaign(campaign) {
    if (
      !campaign ||
      !campaign.placement ||
      campaign.type === "FREE_SHIPPING_GOAL" ||
      campaign.type === "DELIVERY_CUTOFF"
    )
      return;

    var design = campaign.design || {};
    var timerState = calculateTimerState(campaign, new Date());

    if (design.mobileEnabled === false && config.device === "mobile") return;
    if (timerState.isExpired && !(campaign.texts || {}).expiredText) return;
    if (renderedCampaigns[campaign.placement + ":" + campaign.id]) return;

    var bar = document.createElement("section");
    var container = getPlacementContainer(campaign.placement);

    bar.className =
      "pp-bar pp-bar--" + campaign.placement.toLowerCase().replace("_", "-");
    bar.dataset.campaignId = campaign.id;
    bar.setAttribute("role", "region");
    bar.setAttribute(
      "aria-label",
      ((campaign.texts || {}).headline || "Promo Pulse promotion").trim(),
    );
    setDesignProperties(bar, design);

    if (campaign.placement === "TOP_BAR" && design.positionSticky) {
      bar.classList.add("pp-bar--sticky");
    }

    bar.appendChild(renderIcon(design));
    bar.appendChild(renderMessage(campaign, timerState));

    if (
      !timerState.isExpired &&
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode)
    ) {
      bar.appendChild(
        window.CounterPulseCouponButton(
          campaign.discount.discountCode,
          campaign,
        ),
      );
    }

    if (!timerState.isExpired && (campaign.texts || {}).ctaText) {
      bar.appendChild(
        renderCta(campaign.texts.ctaText, campaign.texts.ctaUrl, campaign),
      );
    }

    if (design.showCloseButton) {
      bar.appendChild(renderCloseButton(bar));
    }

    container.appendChild(bar);
    renderedCampaigns[campaign.placement + ":" + campaign.id] = true;
    startCountdown(bar, campaign);
    emitImpression(campaign);
  }

  function applyExperiment(campaign) {
    if (window.CounterPulseApplyExperiment) {
      return window.CounterPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  function updateDebug(element, message, url) {
    var status;
    var endpoint;

    if (!element || element.dataset.debug !== "true") return;

    status = element.querySelector("[data-pp-debug-status]");
    endpoint = element.querySelector("[data-pp-debug-url]");

    if (status) status.textContent = message;
    if (endpoint && url) endpoint.textContent = url;
  }

  function setDesignProperties(bar, design) {
    bar.style.setProperty(
      "--pp-bg",
      safeColor(design.backgroundColor, "#111827"),
    );
    bar.style.setProperty("--pp-text", safeColor(design.textColor, "#ffffff"));
    bar.style.setProperty(
      "--pp-accent",
      safeColor(design.accentColor, "#22c55e"),
    );
    bar.style.setProperty(
      "--pp-button",
      safeColor(design.buttonColor, "#ffffff"),
    );
    bar.style.setProperty(
      "--pp-button-text",
      safeColor(design.buttonTextColor, "#111827"),
    );
    bar.style.setProperty(
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 14) + "px",
    );
    bar.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 24, 0) + "px",
    );
    bar.style.setProperty("--pp-justify", getJustifyContent(design.alignment));
    bar.style.setProperty("--pp-align", getTextAlign(design.alignment));
  }

  function getPlacementContainer(placement) {
    var id = placement === "BOTTOM_BAR" ? "pp-bottom-bars" : "pp-top-bars";
    var existingContainer = document.getElementById(id);
    var container;

    if (existingContainer) return existingContainer;

    container = document.createElement("div");
    container.id = id;
    container.className =
      "pp-container pp-container--" + placement.toLowerCase().replace("_", "-");

    if (placement === "BOTTOM_BAR") {
      document.body.appendChild(container);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }

    return container;
  }

  function renderIcon(design) {
    var icon = document.createElement("span");
    var iconLabel = getIconLabel(design.showIcon ? design.icon : "NONE");

    icon.className = "pp-icon";
    icon.textContent = iconLabel;
    icon.hidden = !iconLabel;

    return icon;
  }

  function renderMessage(campaign, timerState) {
    var texts = campaign.texts || {};
    var message = document.createElement("div");
    var headline = document.createElement("strong");
    var subheadline = document.createElement("span");

    message.className = "pp-message";
    headline.textContent = texts.headline || campaign.name || "Ad";
    message.appendChild(headline);

    if (timerState.isExpired && texts.expiredText) {
      subheadline.textContent = texts.expiredText;
      message.appendChild(subheadline);
    } else if (texts.subheadline) {
      subheadline.textContent = texts.subheadline;
      message.appendChild(subheadline);
    }

    if (timerState.isActive) {
      message.appendChild(renderCountdown(timerState));
    }

    return message;
  }

  function renderCountdown(timerState) {
    var countdown = document.createElement("span");

    countdown.className = "pp-countdown";
    countdown.textContent = formatTimeRemaining(timerState.remainingMs);
    countdown.setAttribute("aria-live", "polite");
    countdown.setAttribute("aria-label", "Time remaining");

    return countdown;
  }

  function renderCta(text, url, campaign) {
    var cta = document.createElement("a");

    cta.className = "pp-cta";
    cta.href = isSafeUrl(url) ? url : "#";
    cta.textContent = text;
    cta.setAttribute("aria-label", text);
    cta.addEventListener("click", function () {
      document.dispatchEvent(
        new CustomEvent("counterpulse:click", {
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
    });

    return cta;
  }

  function renderCloseButton(bar) {
    var button = document.createElement("button");

    button.className = "pp-close";
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.innerHTML = "&times;";
    button.addEventListener("click", function () {
      bar.remove();
    });

    return button;
  }

  function startCountdown(bar, campaign) {
    if (!bar.querySelector(".pp-countdown")) return;

    window.setInterval(function () {
      var timerState = calculateTimerState(campaign, new Date());
      var countdown = bar.querySelector(".pp-countdown");
      var subheadline = bar.querySelector(
        ".pp-message span:not(.pp-countdown)",
      );
      var expiredText = (campaign.texts || {}).expiredText || "";

      if (!countdown) return;

      if (timerState.isExpired) {
        countdown.remove();
        bar.classList.add("pp-bar--expired");

        if (expiredText && subheadline) {
          subheadline.textContent = expiredText;
        } else if (!expiredText) {
          bar.remove();
        }

        return;
      }

      countdown.textContent = formatTimeRemaining(timerState.remainingMs);
    }, 1000);
  }

  function calculateTimerState(campaign, now) {
    var timer = campaign.timer || {};
    var mode = timer.mode || "FIXED_DATE";

    if (mode === "EVERGREEN_SESSION") {
      return calculateEvergreenTimer(campaign, now);
    }

    if (mode === "RECURRING_DAILY") {
      return calculateRecurringDailyTimer(timer, now, campaign.timezone);
    }

    if (mode === "RECURRING_WEEKLY") {
      return calculateRecurringWeeklyTimer(timer, now, campaign.timezone);
    }

    return buildTimerState(now, parseDate(campaign.endsAt));
  }

  function calculateEvergreenTimer(campaign, now) {
    var timer = campaign.timer || {};
    var durationMinutes = Number(timer.durationMinutes);
    var storage = getEvergreenStorage(timer.resetBehavior);
    var key = "counterpulse_deadline_" + campaign.id;
    var stored = readStorage(storage, key);
    var startedAt = parseDate(stored && stored.startedAt);
    var endsAt = parseDate(stored && stored.endsAt);

    if (
      startedAt &&
      endsAt &&
      shouldReuseStorage(startedAt, now, campaign.timezone, timer.resetBehavior)
    ) {
      return buildTimerState(now, endsAt);
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return emptyTimerState();
    }

    startedAt = now;
    endsAt = new Date(now.getTime() + Math.round(durationMinutes) * 60000);
    writeStorage(storage, key, {
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    return buildTimerState(now, endsAt);
  }

  function calculateRecurringDailyTimer(timer, now, timezone) {
    var cutoff = getCutoff(timer);
    var parts;
    var endsAt;

    if (!cutoff) return emptyTimerState();

    parts = getZonedParts(now, timezone);
    endsAt = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      cutoff.hour,
      cutoff.minute,
      timezone,
    );

    return buildTimerState(now, endsAt);
  }

  function calculateRecurringWeeklyTimer(timer, now, timezone) {
    var rules = getWeeklyRules(timer);
    var parts = getZonedParts(now, timezone);
    var todayRule = rules.find(function (rule) {
      return rule.isoWeekday === parts.isoWeekday;
    });
    var todayEndsAt;
    var candidates;

    if (!rules.length) return emptyTimerState();

    if (todayRule) {
      todayEndsAt = zonedTimeToUtc(
        parts.year,
        parts.month,
        parts.day,
        todayRule.hour,
        todayRule.minute,
        timezone,
      );

      if (todayEndsAt.getTime() <= now.getTime()) {
        return buildTimerState(now, todayEndsAt);
      }
    }

    candidates = rules
      .flatMap(function (rule) {
        return buildWeeklyCandidates(rule, now, timezone);
      })
      .filter(function (endsAt) {
        return endsAt.getTime() > now.getTime();
      })
      .sort(function (first, second) {
        return first.getTime() - second.getTime();
      });

    return candidates[0]
      ? buildTimerState(now, candidates[0])
      : emptyTimerState();
  }

  function buildTimerState(now, endsAt) {
    var isExpired;
    var remainingMs;

    if (!endsAt) return emptyTimerState();

    isExpired = endsAt.getTime() <= now.getTime();
    remainingMs = Math.max(0, endsAt.getTime() - now.getTime());

    return {
      isActive: !isExpired,
      isExpired: isExpired,
      remainingMs: remainingMs,
      endsAt: endsAt,
    };
  }

  function emptyTimerState() {
    return {
      isActive: false,
      isExpired: false,
      remainingMs: 0,
      endsAt: null,
    };
  }

  function getCutoff(timer) {
    var firstRule = Array.isArray(timer.recurringDays)
      ? timer.recurringDays.find(isObject)
      : isObject(timer.recurringDays)
        ? timer.recurringDays
        : null;
    var hour = readHour(
      timer.cutoffHour ??
        (firstRule && firstRule.cutoffHour) ??
        (firstRule && firstRule.hour),
    );
    var minute = readMinute(
      timer.cutoffMinute ??
        (firstRule && firstRule.cutoffMinute) ??
        (firstRule && firstRule.minute) ??
        0,
    );

    return hour === null || minute === null
      ? null
      : { hour: hour, minute: minute };
  }

  function getWeeklyRules(timer) {
    var fallback = getCutoff(timer) || { hour: 23, minute: 59 };
    var rules = Array.isArray(timer.recurringDays) ? timer.recurringDays : [];

    return rules
      .filter(isObject)
      .map(function (rule) {
        var isoWeekday = normalizeIsoWeekday(rule.weekday || rule.day);
        var hour = readHour(rule.cutoffHour ?? rule.hour ?? fallback.hour);
        var minute = readMinute(
          rule.cutoffMinute ?? rule.minute ?? fallback.minute,
        );

        return isoWeekday && hour !== null && minute !== null
          ? { isoWeekday: isoWeekday, hour: hour, minute: minute }
          : null;
      })
      .filter(Boolean);
  }

  function buildWeeklyCandidates(rule, now, timezone) {
    var parts = getZonedParts(now, timezone);
    var localMidnight = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      0,
      0,
      timezone,
    );
    var daysUntil = (rule.isoWeekday - parts.isoWeekday + 7) % 7;

    return [daysUntil, daysUntil + 7].map(function (daysToAdd) {
      var candidateParts = getZonedParts(
        new Date(localMidnight.getTime() + daysToAdd * 86400000),
        timezone,
      );

      return zonedTimeToUtc(
        candidateParts.year,
        candidateParts.month,
        candidateParts.day,
        rule.hour,
        rule.minute,
        timezone,
      );
    });
  }

  function shouldReuseStorage(startedAt, now, timezone, resetBehavior) {
    if (resetBehavior === "DAILY") {
      return isSameZonedDay(startedAt, now, timezone);
    }

    if (resetBehavior === "WEEKLY") {
      return isSameZonedWeek(startedAt, now, timezone);
    }

    return true;
  }

  function getEvergreenStorage(resetBehavior) {
    return resetBehavior === "ON_SESSION_END"
      ? window.sessionStorage
      : window.localStorage;
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

  function isSameZonedDay(first, second, timezone) {
    var firstParts = getZonedParts(first, timezone);
    var secondParts = getZonedParts(second, timezone);

    return (
      firstParts.year === secondParts.year &&
      firstParts.month === secondParts.month &&
      firstParts.day === secondParts.day
    );
  }

  function isSameZonedWeek(first, second, timezone) {
    var firstParts = getZonedParts(first, timezone);
    var secondParts = getZonedParts(second, timezone);

    return (
      getWeekStart(firstParts, timezone).getTime() ===
      getWeekStart(secondParts, timezone).getTime()
    );
  }

  function getWeekStart(parts, timezone) {
    var localMidnight = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      0,
      0,
      timezone,
    );

    return new Date(
      localMidnight.getTime() - (parts.isoWeekday - 1) * 86400000,
    );
  }

  function getZonedParts(date, timezone) {
    var formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimezone(timezone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    var parts = {};
    var weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

    formatter.formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
      isoWeekday: weekdayMap[parts.weekday] || 1,
    };
  }

  function zonedTimeToUtc(year, month, day, hour, minute, timezone) {
    var localTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0);
    var utcTimestamp = localTimestamp;
    var index;
    var offset;

    for (index = 0; index < 3; index += 1) {
      offset =
        getZonedTimestamp(new Date(utcTimestamp), timezone) - utcTimestamp;
      utcTimestamp = localTimestamp - offset;
    }

    return new Date(utcTimestamp);
  }

  function getZonedTimestamp(date, timezone) {
    var parts = getZonedParts(date, timezone);

    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
  }

  function formatTimeRemaining(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    if (days > 0) {
      return days + "d " + pad(hours) + "h " + pad(minutes) + "m";
    }

    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function readHour(value) {
    var hour = Number(value);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  function readMinute(value) {
    var minute = Number(value);
    return Number.isInteger(minute) && minute >= 0 && minute <= 59
      ? minute
      : null;
  }

  function normalizeIsoWeekday(value) {
    var weekdays = {
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
      sunday: 7,
      sun: 7,
    };
    var normalized;

    if (typeof value === "number") {
      if (value >= 1 && value <= 7) return value;
      if (value === 0) return 7;
    }

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

  function detectShop(element) {
    return (
      element.dataset.shop ||
      (window.Shopify && window.Shopify.shop) ||
      window.location.hostname
    );
  }

  function detectLocale(element) {
    return (
      element.dataset.locale ||
      element.dataset.defaultLocale ||
      document.documentElement.lang ||
      window.navigator.language ||
      "en"
    );
  }

  function detectCountry(element) {
    return (
      element.dataset.country ||
      (window.Shopify && window.Shopify.country) ||
      ""
    );
  }

  function detectMarket(element) {
    var shopifyMarket = window.Shopify && window.Shopify.market;

    return (
      element.dataset.market ||
      (shopifyMarket &&
        (shopifyMarket.handle || shopifyMarket.id || shopifyMarket)) ||
      ""
    );
  }

  function detectCurrency(element) {
    return (
      element.dataset.cartCurrency ||
      window.CounterPulseCartCurrency ||
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

  function detectCartSubtotal() {
    return typeof window.CounterPulseCartSubtotal === "number"
      ? window.CounterPulseCartSubtotal
      : null;
  }

  function getIconLabel(icon) {
    return (
      {
        FIRE: "Sale",
        CLOCK: "Time",
        TRUCK: "Ship",
        GIFT: "Gift",
        TAG: "Deal",
        NONE: "",
      }[icon] || ""
    );
  }

  function getJustifyContent(alignment) {
    if (alignment === "LEFT") return "flex-start";
    if (alignment === "RIGHT") return "flex-end";
    return "center";
  }

  function getTextAlign(alignment) {
    if (alignment === "LEFT") return "left";
    if (alignment === "RIGHT") return "right";
    return "center";
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
  }

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, Math.round(number)))
      : fallback;
  }

  function isSafeUrl(url) {
    return url ? url.charAt(0) === "/" || /^https?:\/\//i.test(url) : false;
  }

  function isObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function debug() {
    if (config.debugMode && window.console) {
      window.console.log.apply(
        window.console,
        [""].concat([].slice.call(arguments)),
      );
    }
  }

  function applyStorefrontSettings(settings) {
    if (!settings || typeof settings !== "object") return;

    window.CounterPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;

    if (settings.defaultLocale && !config.locale) {
      config.locale = settings.defaultLocale;
    }
    config.currency = config.currency || settings.defaultCurrency || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
