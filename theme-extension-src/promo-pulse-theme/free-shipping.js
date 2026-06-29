(function () {
  "use strict";

  var root = document.getElementById("promo-pulse-app-embed");
  if (!root) return;

  var config = {
    shop:
      root.dataset.shop ||
      (window.Shopify && window.Shopify.shop) ||
      window.location.hostname,
    path: window.location.pathname,
    locale:
      root.dataset.locale ||
      root.dataset.defaultLocale ||
      document.documentElement.lang ||
      "en",
    country:
      root.dataset.country || (window.Shopify && window.Shopify.country) || "",
    market: detectMarket(root),
    currency: detectCurrency(root) || "USD",
    cartSubtotal: readCartSubtotal(root),
    productId: root.dataset.productId || "",
    productTags: splitList(root.dataset.productTags),
    collectionIds: splitList(root.dataset.collectionIds),
    device: detectDevice(),
    debugMode: root.dataset.debug === "true",
    apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
  };
  var refreshTimer = 0;
  var refreshInFlight = false;
  var refreshQueued = false;
  var lastRefreshAt = 0;
  var minimumRefreshGapMs = 2000;
  var freeShippingCampaigns = [];
  var campaignsLoaded = false;
  var trackedImpressions = {};
  var proxyPauseMs = 60000;
  var cartPauseMs = 30000;

  if (!config.shop) {
    updateDebug(root, "Free shipping detenido: falta el shop domain.");
    return;
  }

  installCartChangeWatcher();
  scheduleRefresh(true, true);
  [
    "promo-pulse:cart-changed",
    "cart:updated",
    "cart:change",
    "cart:refresh",
    "ajaxCart:updated",
    "theme:cart:change",
  ].forEach(function (eventName) {
    document.addEventListener(eventName, function () {
      scheduleRefresh(true, false);
    });
  });
  document.addEventListener("shopify:section:load", function () {
    scheduleRefresh(false, !campaignsLoaded);
  });

  function scheduleRefresh(force, shouldFetchCampaigns) {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(
      function () {
        refresh(!!force, shouldFetchCampaigns !== false);
      },
      force ? 80 : 300,
    );
  }

  function refresh(force, shouldFetchCampaigns) {
    var now = Date.now();

    if (refreshInFlight) return;
    if (!force && now - lastRefreshAt < minimumRefreshGapMs) return;
    if (isPaused("PromoPulseProxyPausedUntil")) {
      updateDebug(
        root,
        "Free shipping pausado temporalmente porque Shopify devolvio password/HTML en una llamada anterior.",
      );
      return;
    }

    refreshInFlight = true;
    lastRefreshAt = now;

    readAjaxCartState()
      .then(function (cartState) {
        config.cartSubtotal =
          cartState.subtotal === null
            ? config.cartSubtotal
            : cartState.subtotal;
        config.currency = cartState.currency || config.currency;
        if (!shouldFetchCampaigns && campaignsLoaded) {
          return freeShippingCampaigns;
        }

        return fetchCampaigns().then(function (campaigns) {
          freeShippingCampaigns = campaigns;
          campaignsLoaded = true;
          return campaigns;
        });
      })
      .then(function (campaigns) {
        updateDebug(
          root,
          "Free shipping API OK: " +
            campaigns.length +
            " campana(s) globales disponibles.",
        );
        campaigns.forEach(renderCampaign);
      })
      .catch(function (error) {
        updateDebug(root, "Error global FREE_SHIPPING_GOAL: " + error.message);
        debug(error);
      })
      .finally(function () {
        refreshInFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          scheduleRefresh(true, false);
        }
      });
  }

  function fetchCampaigns() {
    var params = new URLSearchParams({
      shop: config.shop,
      path: config.path,
      locale: config.locale,
      device: config.device,
      placement: "TOP_BAR,BOTTOM_BAR",
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.productId) params.set("productId", config.productId);
    if (config.productTags.length) {
      params.set("productTags", config.productTags.join(","));
    }
    if (config.collectionIds.length) {
      params.set("collectionIds", config.collectionIds.join(","));
    }
    appendBehaviorTargetingParams(params);
    var url = getCampaignsEndpoint(config.apiBaseUrl) + "?" + params.toString();

    if (isPaused("PromoPulseProxyPausedUntil")) {
      updateDebug(
        root,
        "App Proxy pausado temporalmente porque Shopify devolvio password/HTML en una llamada anterior.",
        url,
      );
      return Promise.resolve([]);
    }

    updateDebug(root, "Consultando FREE_SHIPPING_GOAL global.", url);

    if (window.PromoPulseFetchCampaigns) {
      return window
        .PromoPulseFetchCampaigns(config, "TOP_BAR,BOTTOM_BAR")
        .then(function (payload) {
          applyStorefrontSettings(config, payload.settings);
          return (Array.isArray(payload.campaigns) ? payload.campaigns : [])
            .map(applyExperiment)
            .filter(function (campaign) {
              return campaign.type === "FREE_SHIPPING_GOAL";
            });
        })
        .then(function (campaigns) {
          updateDebug(
            root,
            "API OK: " + campaigns.length + " FREE_SHIPPING_GOAL globales.",
            url,
          );
          return campaigns;
        })
        .catch(function (error) {
          updateDebug(
            root,
            "Error FREE_SHIPPING_GOAL global: " + error.message,
            url,
          );
          debug(error);
          return [];
        });
    }

    return window
      .fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        assertJsonResponse(response, url);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(payload.settings);
        return (Array.isArray(payload.campaigns) ? payload.campaigns : [])
          .map(applyExperiment)
          .filter(function (campaign) {
            return campaign.type === "FREE_SHIPPING_GOAL";
          });
      })
      .then(function (campaigns) {
        updateDebug(
          root,
          "API OK: " + campaigns.length + " FREE_SHIPPING_GOAL globales.",
          url,
        );
        return campaigns;
      })
      .catch(function (error) {
        updateDebug(
          root,
          "Error FREE_SHIPPING_GOAL global: " + error.message,
          url,
        );
        debug(error);
        return [];
      });
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  function assertJsonResponse(response, url) {
    var contentType = response.headers.get("content-type") || "";
    var redirectedTo = response.redirected
      ? " Redirected to " + response.url
      : "";

    if (
      response.redirected ||
      response.url.indexOf("/password") !== -1 ||
      contentType.indexOf("application/json") === -1
    ) {
      pauseRequests("PromoPulseProxyPausedUntil", proxyPauseMs);
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

  function renderCampaign(campaign) {
    var design = campaign.design || {};
    var slotId = "promo-pulse-free-shipping-" + campaign.placement;
    var existing = document.getElementById(slotId);
    var container;
    var bar;

    if (design.mobileEnabled === false && config.device === "mobile") {
      updateDebug(
        root,
        "FREE_SHIPPING_GOAL recibido, pero mobileEnabled=false y el dispositivo detectado es mobile.",
      );
      return;
    }

    if (!window.CountPulseSurface) {
      updateDebug(root, "Surface module no disponible todavia.");
      return;
    }

    container = getPlacementContainer(campaign.placement);
    if (existing) {
      updateExistingBar(existing, campaign);
      emitImpressionOnce(campaign);
      return;
    }

    bar = buildBar(campaign);
    bar.id = slotId;
    container.appendChild(bar);
    startCountdown(bar, campaign);
    emitImpressionOnce(campaign);
  }

  function updateExistingBar(bar, campaign) {
    var progress = calculateProgress(campaign);
    // Custom structures put the message in a data-cp-slot="body"; the legacy
    // layout uses the message-copy span. Update whichever exists.
    var detail =
      bar.querySelector('[data-cp-slot="body"]') ||
      bar.querySelector(".counterpulse-preview-message-copy > span");
    var countdown = bar.querySelector("[data-cp-timer]");
    var timerState = calculateTimerState(campaign, new Date());

    if (detail) {
      // Re-resolve the free-shipping tokens, then the global ones (time/date),
      // so every variable updates live when the cart changes.
      var body = buildMessage(campaign, progress);
      if (window.CountPulseSurface && window.CountPulseSurface.interpolate) {
        body = window.CountPulseSurface.interpolate(body, {
          locale: config.locale,
          endsAt: campaign.endsAt,
          timezone: campaign.timezone,
          timer: { remainingMs: timerState.remainingMs },
          variables: freeShippingVars(campaign, progress),
        });
      }
      updateText(detail, body);
    }

    updateProgress(bar, campaign, progress, detail ? detail.textContent : "");

    if (countdown && timerState.isActive) {
      window.CountPulseSurface.updateTimer(
        countdown,
        timerState.remainingMs,
        campaign.design || {},
      );
    }

    if (timerState.isExpired) {
      countdown && countdown.remove();
      bar.classList.add("counterpulse-preview-promo--expired");

      if (shouldHideExpiredCampaign(campaign)) {
        removeBar(bar, campaign.design || {});
      }
    }
  }

  function updateText(element, value) {
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
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

  function buildBar(campaign) {
    var design = campaign.design || {};
    var texts = campaign.texts || {};
    var progress = calculateProgress(campaign);
    var timerState = calculateTimerState(campaign, new Date());

    var couponNode = null;
    if (
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.PromoPulseCouponButton === "function"
    ) {
      couponNode = window.PromoPulseCouponButton(
        campaign.discount.discountCode,
        campaign,
      );
    }

    var progressSpec =
      design.showProgressBar !== false
        ? {
            percentage: Math.max(0, Math.min(100, progress.percentage)),
            style: readProgressStyle(campaign),
            unlocked: progress.unlocked,
          }
        : null;

    var variant =
      campaign.placement === "TOP_BAR" || campaign.placement === "BOTTOM_BAR"
        ? "bar"
        : "block";

    var bar = window.CountPulseSurface.build({
      variant: variant,
      placement: campaign.placement,
      design: design,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: config.locale,
      variables: freeShippingVars(campaign, progress),
      headline: texts.headline || "Free shipping",
      body: buildMessage(campaign, progress),
      timer: {
        isActive: timerState.isActive,
        isExpired: timerState.isExpired,
        remainingMs: timerState.remainingMs,
      },
      hasTimer: timerState.isActive,
      couponNode: couponNode,
      cta: design.showButton !== false ? texts.ctaText || "" : "",
      ctaUrl: texts.ctaUrl || "",
      progress: progressSpec,
      dataTestId: "promo-bar",
      onClose: function () {
        removeBar(bar, design);
      },
    });

    bar.dataset.campaignId = campaign.id;
    if (
      campaign.placement === "TOP_BAR" &&
      design.positionMode !== "OVERLAY" &&
      design.positionSticky
    ) {
      bar.classList.add("counterpulse-preview-promo--sticky");
    }

    return bar;
  }

  // Canonical free-shipping message variables (mirrors buildFreeShippingVariables
  // in app/lib/free-shipping.ts and the preview).
  function freeShippingVars(campaign, progress) {
    var currency = (campaign.freeShipping || {}).currencyCode;
    var pct = Math.round(progress.percentage);
    return {
      remaining_amount: money(progress.amountRemaining, currency),
      cart_subtotal: money(progress.cartSubtotal, currency),
      threshold_amount: money(
        Number((campaign.freeShipping || {}).thresholdAmount || 0),
        currency,
      ),
      progress_percent: pct + "%",
      remaining_percent: Math.max(0, 100 - pct) + "%",
    };
  }

  // Replaces every free-shipping token in a template (not just remaining_amount),
  // so the body resolves the same way on initial render and on cart updates.
  function interpolateFreeShipping(template, vars) {
    return String(template || "").replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      function (match, key) {
        return Object.prototype.hasOwnProperty.call(vars, key)
          ? vars[key]
          : match;
      },
    );
  }

  function buildMessage(campaign, progress) {
    var texts = campaign.texts || {};
    var settings = campaign.freeShipping || {};
    var vars = freeShippingVars(campaign, progress);

    if (progress.cartSubtotal <= 0) {
      return (
        texts.freeShippingEmptyText ||
        settings.emptyCartMessage ||
        interpolateFreeShipping(
          texts.freeShippingProgressText ||
            "You're {{remaining_amount}} away from free shipping",
          vars,
        )
      );
    }

    if (progress.unlocked) {
      return (
        texts.freeShippingSuccessText ||
        settings.successMessage ||
        "You've unlocked free shipping!"
      );
    }

    return interpolateFreeShipping(
      texts.freeShippingProgressText ||
        "You're {{remaining_amount}} away from free shipping",
      vars,
    );
  }

  function calculateProgress(campaign) {
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

  function renderProgress(campaign, progress, label) {
    var wrapper = document.createElement("div");
    var track = document.createElement("span");
    var fill = document.createElement("span");
    var percentage = Math.max(0, Math.min(100, progress.percentage));

    wrapper.className = progressClassName("pp-progress", campaign);
    if (progress.unlocked) wrapper.classList.add("is-unlocked");
    wrapper.style.setProperty("--pp-progress", percentage + "%");
    wrapper.dataset.testid = "free-shipping-progress";
    track.className = "pp-progress__track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", label || "Free shipping progress");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.round(percentage)));
    fill.className = "pp-progress__fill";
    fill.style.width = percentage + "%";
    track.appendChild(fill);
    wrapper.appendChild(track);

    return wrapper;
  }

  function updateProgress(bar, campaign, progress, label) {
    var wrapper = bar.querySelector(".counterpulse-preview-progress");
    var fill = wrapper && wrapper.querySelector("span > span");
    var percentage = Math.max(0, Math.min(100, progress.percentage));

    if (!wrapper) return;

    wrapper.classList.toggle(
      "counterpulse-preview-progress--unlocked",
      progress.unlocked,
    );
    wrapper.style.setProperty("--cp-progress", percentage + "%");
    if (fill) {
      fill.style.width = percentage + "%";
    }
  }

  function progressClassName(baseClass, campaign) {
    var style = readProgressStyle(campaign);

    return style === "BAR"
      ? baseClass
      : baseClass + " " + baseClass + "--" + style.toLowerCase();
  }

  function renderCountdown(ms, design, compact) {
    var timerStyle = safeTimerStyle(design.timerStyle);
    var timerFormat = safeTimerFormat(design.timerFormat);
    var countdown = document.createElement(
      compact && timerStyle === "PLAIN" ? "span" : "div",
    );
    var tickClass =
      design.timerTickAnimation && design.timerTickAnimation !== "NONE"
        ? " pp-countdown--tick-" +
          String(design.timerTickAnimation).toLowerCase()
        : "";

    countdown.className =
      "pp-countdown pp-countdown--" +
      timerStyle.toLowerCase() +
      " pp-countdown--" +
      timerFormat.toLowerCase() +
      (compact ? " pp-countdown--compact" : "") +
      tickClass;
    countdown.dataset.testid = "promo-timer";
    updateCountdownElement(countdown, ms, design, compact);
    countdown.setAttribute("aria-live", "polite");
    countdown.setAttribute("aria-label", "Time remaining");

    return countdown;
  }

  function updateCountdownElement(countdown, ms, design, compact) {
    var timerStyle = safeTimerStyle(design.timerStyle);
    var timerFormat = safeTimerFormat(design.timerFormat);
    var parts = buildTimerParts(ms, design);
    var visibleParts =
      design.timerShowSeconds === false
        ? parts.filter(function (part) {
            return part.key !== "seconds";
          })
        : parts;
    var nextText;

    if (!visibleParts.length) visibleParts = [parts[parts.length - 1]];

    if (timerFormat === "COLON") {
      nextText = visibleParts
        .map(function (part) {
          return part.value;
        })
        .join(":");
      if (countdown.dataset.value === nextText) return;

      countdown.dataset.value = nextText;
      countdown.textContent = nextText;
      return;
    }

    nextText = visibleParts
      .map(function (part) {
        return design.timerShowLabels === false
          ? part.value
          : part.value + " " + part.shortLabel;
      })
      .join(" ");

    if (timerStyle === "PLAIN" && compact) {
      if (countdown.dataset.value === nextText) return;

      countdown.dataset.value = nextText;
      countdown.textContent = nextText;
      return;
    }

    if (countdown.dataset.value === nextText) return;

    var previousUnitValues = readCountdownUnitValues(countdown);
    var tickAnimation = getCountdownTickAnimation(countdown);
    countdown.dataset.value = nextText;
    countdown.dataset.unitValues = JSON.stringify(
      visibleParts.reduce(function (values, part) {
        values[part.key] = part.value;
        return values;
      }, {}),
    );
    countdown.replaceChildren();
    visibleParts.forEach(function (part) {
      var unit = document.createElement("span");
      var value = document.createElement("strong");
      var label = document.createElement("small");

      unit.className = "pp-countdown-unit";
      value.textContent = part.value;
      if (
        tickAnimation &&
        previousUnitValues[part.key] &&
        previousUnitValues[part.key] !== part.value
      ) {
        value.classList.add(
          "pp-countdown-tick-value",
          "pp-countdown-tick-value--" + tickAnimation,
        );
      }
      unit.appendChild(value);

      if (design.timerShowLabels !== false) {
        label.textContent = part.label;
        unit.appendChild(label);
      }

      countdown.appendChild(unit);
    });
  }

  function startCountdown(bar, campaign) {
    if (!bar.querySelector("[data-cp-timer]")) return;

    bar.__promoPulseTimerInterval = window.setInterval(function () {
      var state = calculateTimerState(campaign, new Date());
      var countdown = bar.querySelector("[data-cp-timer]");
      var design = campaign.design || {};

      if (!countdown) return;

      if (state.isExpired) {
        countdown.remove();
        bar.classList.add("counterpulse-preview-promo--expired");

        if (shouldHideExpiredCampaign(campaign)) {
          removeBar(bar, design);
        }
        return;
      }

      window.CountPulseSurface.updateTimer(countdown, state.remainingMs, design);
    }, 1000);
  }

  function calculateTimerState(campaign, now) {
    var timer = campaign.timer || {};
    var mode = timer.mode || "FIXED_DATE";

    if (mode === "EVERGREEN_SESSION")
      return calculateEvergreenTimer(campaign, now);
    if (mode === "RECURRING_DAILY") return calculateDailyTimer(timer, now);

    return remainingUntil(now, parseDate(campaign.endsAt));
  }

  function calculateEvergreenTimer(campaign, now) {
    var timer = campaign.timer || {};
    var duration = Number(timer.durationMinutes);
    var storage =
      timer.resetBehavior === "NEVER" ? localStorage : sessionStorage;
    var key = "promo_pulse_deadline_" + campaign.id;
    var saved = readStoredTimer(storage, key);
    var endsAt = parseDate(saved && saved.endsAt);

    if (endsAt && endsAt.getTime() > now.getTime()) {
      return remainingUntil(now, endsAt);
    }

    if (!Number.isFinite(duration) || duration <= 0) return emptyTimerState();

    endsAt = new Date(now.getTime() + Math.round(duration) * 60000);
    writeStoredTimer(storage, key, { endsAt: endsAt.toISOString() });

    return remainingUntil(now, endsAt);
  }

  function calculateDailyTimer(timer, now) {
    var hour = clamp(timer.cutoffHour, 0, 23, 23);
    var minute = clamp(timer.cutoffMinute, 0, 59, 59);
    var endsAt = new Date(now);

    endsAt.setHours(hour, minute, 0, 0);
    if (endsAt.getTime() <= now.getTime()) {
      endsAt.setDate(endsAt.getDate() + 1);
    }

    return remainingUntil(now, endsAt);
  }

  function remainingUntil(now, endsAt) {
    if (!endsAt) return emptyTimerState();

    var remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
    var expired = remainingMs <= 0;

    return {
      isActive: !expired,
      isExpired: expired,
      remainingMs: remainingMs,
      endsAt: endsAt,
    };
  }

  function emptyTimerState() {
    return { isActive: false, isExpired: false, remainingMs: 0, endsAt: null };
  }

  function readStoredTimer(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function writeStoredTimer(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function shouldHideExpiredCampaign(campaign) {
    var behavior = ((campaign.timer || {}).expiredBehavior || "").toUpperCase();

    return behavior === "HIDE_TIMER" || behavior === "UNPUBLISH_TIMER";
  }

  function buildTimerParts(ms, design) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var showDays = design.timerHideZeroDays === false || days > 0;
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var parts = [];

    if (showDays) {
      parts.push(timerPart("days", days, design.timerDaysLabel, "Days"));
    }
    parts.push(
      timerPart(
        "hours",
        showDays ? hours : Math.floor(totalSeconds / 3600),
        design.timerHoursLabel,
        "Hrs",
      ),
    );
    parts.push(timerPart("minutes", minutes, design.timerMinutesLabel, "Mins"));
    parts.push(timerPart("seconds", seconds, design.timerSecondsLabel, "Secs"));

    return parts;
  }

  function timerPart(key, value, label, fallbackLabel) {
    return {
      key: key,
      value: pad(value),
      label: label || fallbackLabel,
      shortLabel: fallbackLabel,
    };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function safeTimerStyle(value) {
    return value === "GROUPED" || value === "BOXES" ? value : "PLAIN";
  }

  function safeTimerFormat(value) {
    return value === "COLON" ? "COLON" : "UNITS";
  }

  function getCountdownTickAnimation(countdown) {
    var match = String(countdown.className || "").match(
      /\bpp-countdown--tick-(fade|flip|pulse)\b/,
    );

    return match ? match[1] : "";
  }

  function readCountdownUnitValues(countdown) {
    try {
      return JSON.parse(countdown.dataset.unitValues || "{}");
    } catch (error) {
      return {};
    }
  }

  function replayCountdownTick(countdown) {
    [].slice
      .call(countdown.querySelectorAll(".pp-countdown-tick-value"))
      .forEach(function (value) {
        value.classList.remove("pp-countdown-tick-value");
        void value.offsetWidth;
        value.classList.add("pp-countdown-tick-value");
      });
  }

  function readProgressStyle(campaign) {
    var style = String(
      (campaign.freeShipping || {}).progressStyle || "BAR",
    ).toUpperCase();

    return style === "COMPACT" || style === "CIRCULAR" ? style : "BAR";
  }

  function getPlacementContainer(placement) {
    var id = placement === "BOTTOM_BAR" ? "pp-bottom-bars" : "pp-top-bars";
    var existing = document.getElementById(id);
    var container;
    var configuredTarget;

    if (existing) return existing;

    configuredTarget = querySelectorList(getConfiguredSelector(placement));
    container = document.createElement("div");
    container.id = id;
    container.className =
      "pp-container pp-container--" + placement.toLowerCase().replace("_", "-");

    if (placement === "BOTTOM_BAR") {
      (configuredTarget || document.body).appendChild(container);
    } else if (configuredTarget) {
      configuredTarget.insertBefore(container, configuredTarget.firstChild);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }

    return container;
  }

  function getConfiguredSelector(placement) {
    var settings = window.PromoPulseSettings || {};
    var key =
      placement === "TOP_BAR"
        ? "customTopBarSelector"
        : placement === "BOTTOM_BAR"
          ? "customBottomBarSelector"
          : "";
    if (!key) return "";

    if (
      settings.separateMobileSelectors &&
      config.device === "mobile" &&
      settings.mobileSelectors &&
      settings.mobileSelectors[key]
    ) {
      return settings.mobileSelectors[key];
    }

    return settings[key] || "";
  }

  function querySelectorList(selector) {
    var selectors;
    var index;
    var currentSelector;
    var target;

    if (!selector || typeof selector !== "string") return null;

    selectors = selector
      .split(",")
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean);

    for (index = 0; index < selectors.length; index += 1) {
      currentSelector = selectors[index];

      try {
        target = document.querySelector(currentSelector);
        if (target) return target;
      } catch (error) {
        debug("Invalid selector", currentSelector, error);
      }
    }

    return null;
  }

  function installCartChangeWatcher() {
    if (window.PromoPulseCartWatcherReady) return;

    window.PromoPulseCartWatcherReady = true;

    if (window.fetch) {
      var nativeFetch = window.fetch;

      window.fetch = function (input, init) {
        var shouldNotify = isCartMutationRequest(input, init);

        return nativeFetch.apply(this, arguments).then(function (response) {
          if (shouldNotify && response && response.ok) {
            updateCartStateFromResponse(response).then(function (cartState) {
              notifyCartChanged(!cartState);
            });
          }

          return response;
        });
      };
    }

    if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
      var nativeOpen = window.XMLHttpRequest.prototype.open;
      var nativeSend = window.XMLHttpRequest.prototype.send;

      window.XMLHttpRequest.prototype.open = function (method, url) {
        this.__promoPulseCartMutation = isCartMutation(method, url);
        return nativeOpen.apply(this, arguments);
      };

      window.XMLHttpRequest.prototype.send = function () {
        if (this.__promoPulseCartMutation) {
          this.addEventListener("loadend", function () {
            if (this.status >= 200 && this.status < 400) {
              notifyCartChanged(!updateCartStateFromText(this.responseText));
            }
          });
        }

        return nativeSend.apply(this, arguments);
      };
    }
  }

  function notifyCartChanged(forceCartFetch) {
    if (typeof window.PromoPulseClearRequestCache === "function") {
      window.PromoPulseClearRequestCache("cart");
    }
    if (forceCartFetch && window.PromoPulseCartState) {
      window.PromoPulseCartState.updatedAt = 0;
    }

    window.clearTimeout(window.PromoPulseCartChangedTimer);
    window.PromoPulseCartChangedTimer = window.setTimeout(function () {
      document.dispatchEvent(new CustomEvent("promo-pulse:cart-changed"));
    }, 120);
  }

  function isCartMutationRequest(input, init) {
    var method = (init && init.method) || (input && input.method) || "GET";
    var url = typeof input === "string" ? input : input && input.url;

    return isCartMutation(method, url);
  }

  function isCartMutation(method, url) {
    var pathname;

    if (String(method || "GET").toUpperCase() === "GET") return false;

    try {
      pathname = new URL(url || "", window.location.href).pathname;
    } catch (error) {
      return false;
    }

    // Match cart routes even when the storefront prefixes them with a locale or
    // market path (e.g. /en-gb/cart/add.js), so "Add to cart" is detected on
    // localized stores, not only /cart/add.js.
    return /(^|\/)cart\/(add|change|update|clear)(\.js)?$/.test(pathname);
  }

  function readAjaxCartState() {
    var recentCartState = readRecentCartState();

    if (recentCartState) {
      return Promise.resolve(recentCartState);
    }

    if (isPaused("PromoPulseCartPausedUntil")) {
      return Promise.resolve({ subtotal: null, currency: "" });
    }

    return window
      .fetch("/cart.js", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        assertCartJsonResponse(response);
        return response.json();
      })
      .then(function (cart) {
        updateCartState(cart);

        return {
          subtotal:
            typeof cart.total_price === "number"
              ? cart.total_price / 100
              : null,
          currency: cart.currency || "",
        };
      })
      .catch(function () {
        return { subtotal: null, currency: "" };
      });
  }

  function updateCartStateFromResponse(response) {
    try {
      return response
        .clone()
        .json()
        .then(updateCartState)
        .catch(function () {
          return null;
        });
    } catch (error) {
      return Promise.resolve(null);
    }
  }

  function updateCartStateFromText(value) {
    try {
      return updateCartState(JSON.parse(value || "null"));
    } catch (error) {
      return null;
    }
  }

  function updateCartState(cart) {
    if (typeof window.PromoPulseUpdateCartState === "function") {
      return window.PromoPulseUpdateCartState(cart);
    }

    if (!cart || typeof cart.total_price !== "number") return null;

    window.PromoPulseCartSubtotal = cart.total_price / 100;
    window.PromoPulseCartCurrency =
      cart.currency || window.PromoPulseCartCurrency || "";
    window.PromoPulseCartToken = cart.token || window.PromoPulseCartToken || "";
    window.PromoPulseCartState = {
      subtotal: window.PromoPulseCartSubtotal,
      currency: window.PromoPulseCartCurrency,
      token: window.PromoPulseCartToken,
      updatedAt: Date.now(),
    };

    return window.PromoPulseCartState;
  }

  function readRecentCartState() {
    if (typeof window.PromoPulseGetCartState !== "function") return null;

    return window.PromoPulseGetCartState(2500);
  }

  function assertCartJsonResponse(response) {
    var contentType = response.headers.get("content-type") || "";

    if (
      response.redirected ||
      response.url.indexOf("/password") !== -1 ||
      contentType.indexOf("application/json") === -1
    ) {
      pauseRequests("PromoPulseCartPausedUntil", cartPauseMs);
      throw new Error(
        "Expected JSON from /cart.js but received storefront HTML.",
      );
    }
  }

  function readCartSubtotal(element) {
    var cents = Number(element.dataset.cartTotalCents);
    if (Number.isFinite(cents)) return cents / 100;
    if (typeof window.PromoPulseCartSubtotal === "number") {
      return window.PromoPulseCartSubtotal;
    }
    return null;
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

  function setDesign(element, design) {
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
      "--pp-close",
      color(design.closeButtonColor, color(design.textColor, "#ffffff")),
    );
    element.style.setProperty(
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 14) + "px",
    );
    element.style.setProperty(
      "--pp-font-family",
      fontFamily(design.fontFamily),
    );
    element.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 999, 0) + "px",
    );
    element.style.setProperty(
      "--pp-border-size",
      clamp(design.borderSize, 0, 8, 0) + "px",
    );
    element.style.setProperty(
      "--pp-border-color",
      color(design.borderColor, "transparent"),
    );
    element.style.setProperty(
      "--pp-title-size",
      clamp(design.titleFontSize, 12, 48, 18) + "px",
    );
    element.style.setProperty(
      "--pp-title-color",
      color(design.titleColor, color(design.textColor, "#ffffff")),
    );
    element.style.setProperty(
      "--pp-subheading-size",
      clamp(design.subheadingFontSize, 10, 32, 14) + "px",
    );
    element.style.setProperty(
      "--pp-subheading-color",
      color(design.subheadingColor, color(design.textColor, "#ffffff")),
    );
    element.style.setProperty(
      "--pp-timer-size",
      clamp(design.timerFontSize, 12, 72, 24) + "px",
    );
    element.style.setProperty(
      "--pp-timer-color",
      color(design.timerColor, color(design.textColor, "#ffffff")),
    );
    element.style.setProperty(
      "--pp-legend-size",
      clamp(design.legendFontSize, 10, 24, 12) + "px",
    );
    element.style.setProperty(
      "--pp-legend-color",
      color(design.legendColor, color(design.textColor, "#ffffff")),
    );
    element.style.setProperty(
      "--pp-timer-surface",
      color(design.timerSurfaceColor, "rgba(255,255,255,.12)"),
    );
    element.style.setProperty(
      "--pp-timer-border",
      color(design.timerSurfaceBorderColor, "transparent"),
    );
    element.style.setProperty(
      "--pp-timer-border-size",
      clamp(design.timerSurfaceBorderSize, 0, 6, 0) + "px",
    );
    element.style.setProperty(
      "--pp-timer-radius",
      clamp(design.timerSurfaceRadius, 0, 40, 8) + "px",
    );
    element.style.setProperty(
      "--pp-content-max-width",
      clamp(design.contentMaxWidth, 280, 1440, 960) + "px",
    );
    element.style.setProperty(
      "--pp-padding-block",
      clamp(design.paddingBlock, 4, 48, 11) + "px",
    );
    element.style.setProperty(
      "--pp-padding-inline",
      clamp(design.paddingInline, 8, 64, 16) + "px",
    );
    element.style.setProperty("--pp-justify", justify(design.alignment));
    element.style.setProperty("--pp-align", align(design.alignment));
    element.style.setProperty(
      "--pp-gap",
      clamp(design.contentGap, 4, 48, 10) + "px",
    );
    element.style.setProperty(
      "--pp-icon-size",
      clamp(design.iconSize, 12, 64, 20) + "px",
    );
    element.style.setProperty(
      "--pp-offer-code-text",
      color(design.offerCodeTextColor, "#111827"),
    );
    element.style.setProperty(
      "--pp-offer-code-bg",
      color(design.offerCodeBackgroundColor, "#ffffff"),
    );
    element.style.setProperty(
      "--pp-offer-code-border",
      color(design.offerCodeBorderColor, "#d1d5db"),
    );
    element.style.setProperty(
      "--pp-offer-code-size",
      clamp(design.offerCodeFontSize, 10, 24, 13) + "px",
    );
    element.style.setProperty(
      "--pp-offer-code-radius",
      clamp(design.offerCodeBorderRadius, 0, 40, 4) + "px",
    );
    element.style.setProperty(
      "--pp-offer-code-padding-block",
      clamp(design.offerCodePaddingBlock, 2, 24, 5) + "px",
    );
    element.style.setProperty(
      "--pp-offer-code-padding-inline",
      clamp(design.offerCodePaddingInline, 4, 32, 8) + "px",
    );
    element.style.setProperty(
      "--pp-offer-gap",
      clamp(design.offerCodeGap, 0, 24, 6) + "px",
    );
    element.style.setProperty(
      "--pp-motion-duration",
      clamp(design.animationDurationMs, 0, 1500, 220) + "ms",
    );
  }

  function fontFamily(value) {
    if (value === "SERIF") return "Georgia, Times New Roman, serif";
    if (value === "MONO")
      return "ui-monospace, SFMono-Regular, Menlo, monospace";
    if (value === "ROUNDED")
      return "ui-rounded, Arial Rounded MT Bold, system-ui, sans-serif";
    if (value === "GEOMETRIC")
      return "Avenir Next, Montserrat, system-ui, sans-serif";
    if (value === "HUMANIST") return "Optima, Gill Sans, system-ui, sans-serif";
    if (value === "CONDENSED")
      return "Arial Narrow, Roboto Condensed, system-ui, sans-serif";
    if (value === "CASUAL")
      return "Trebuchet MS, Comic Sans MS, system-ui, sans-serif";
    if (value === "SYSTEM")
      return "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

    return "inherit";
  }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        currency: currency || config.currency || "USD",
        style: "currency",
      }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function link(className, text, href) {
    var anchor = node("a", className, text);
    anchor.href = href;
    anchor.setAttribute("aria-label", text);
    return anchor;
  }

  function renderCloseButton(bar, design) {
    var button = document.createElement("button");
    button.className = "pp-close";
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.innerHTML = "&times;";
    button.addEventListener("click", function () {
      removeBar(bar, design || {});
    });
    return button;
  }

  function removeBar(bar, design) {
    var duration = clamp((design || {}).animationDurationMs, 0, 1500, 220);

    if (
      !(design || {}).exitAnimation ||
      (design || {}).exitAnimation === "NONE" ||
      duration === 0
    ) {
      bar.remove();
      return;
    }

    bar.classList.add("pp-bar--closing");
    window.setTimeout(function () {
      bar.remove();
    }, duration);
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

  function emitImpressionOnce(campaign) {
    var key = campaign.placement + ":" + campaign.id;

    if (trackedImpressions[key]) return;

    trackedImpressions[key] = true;
    emitImpression(campaign);
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

    svg = getIconSvg(design.icon || "TRUCK");
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

  function align(value) {
    if (value === "LEFT") return "left";
    if (value === "RIGHT") return "right";
    return "center";
  }

  function isSafeUrl(url) {
    return url ? url.charAt(0) === "/" || /^https?:\/\//i.test(url) : false;
  }

  function isPaused(key) {
    return Number(window[key] || 0) > Date.now();
  }

  function pauseRequests(key, ms) {
    window[key] = Math.max(Number(window[key] || 0), Date.now() + ms);
  }

  function debug() {
    if (config.debugMode && window.console) {
      window.console.log.apply(
        window.console,
        [""].concat([].slice.call(arguments)),
      );
    }
  }

  function applyStorefrontSettings(configOrSettings, maybeSettings) {
    var settings = maybeSettings || configOrSettings;

    if (!settings || typeof settings !== "object") return;

    window.PromoPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;
    config.currency = config.currency || settings.defaultCurrency || "";
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
