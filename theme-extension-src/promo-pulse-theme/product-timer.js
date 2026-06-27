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
      updateDebug(root, "Campana cerrada por el visitante; no se vuelve a mostrar.");
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
    if (
      campaign.type === "FREE_SHIPPING_GOAL" &&
      design.showProgressBar !== false
    ) {
      var fs = calculateFreeShippingProgress(campaign, config);
      progress = {
        percentage: fs.percentage,
        style: readProgressStyle(campaign),
        unlocked: fs.unlocked,
      };
    }

    var card = window.CountPulseSurface.build({
      variant: "block",
      placement: campaign.placement || "PRODUCT_PAGE",
      design: design,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: config.locale,
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
      block.dataset.ppProductTimerFullWidth = "true";
      block.style.setProperty("width", "100vw");
      block.style.setProperty("max-width", "100vw");
      block.style.setProperty("margin-left", "calc(50% - 50vw)");
      block.style.setProperty("margin-right", "calc(50% - 50vw)");
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
        root.querySelectorAll(
          ".pp-product-card, .counterpulse-preview-promo",
        ),
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

  function renderMessage(campaign, timerState, config, icon) {
    var texts = campaign.texts || {};
    var message = document.createElement("div");
    var copy = document.createElement("div");
    var subheadline = document.createElement("span");
    var headline = texts.headline || "Limited-time offer";
    var detail = texts.subheadline || "";
    var design = campaign.design || {};
    var isInline = normalizeLayout(design.layout) === "inline";

    message.className = "pp-message";
    copy.className = "pp-message-copy";
    if (icon) message.appendChild(icon);

    if (campaign.type === "FREE_SHIPPING_GOAL") {
      detail = buildFreeShippingText(campaign, config) || detail;
    }

    if (timerState.isExpired && texts.expiredText) {
      detail = texts.expiredText;
    }

    copy.appendChild(node("strong", "", headline));
    if (detail) {
      subheadline.textContent = detail;
      copy.appendChild(subheadline);
    }
    if (timerState.isActive && isInline) {
      copy.appendChild(renderCountdown(timerState.remainingMs, design, true));
    }

    message.appendChild(copy);

    return message;
  }

  function renderCta(text, url) {
    var cta = node("a", "pp-cta", text);
    cta.href =
      url && (url.charAt(0) === "/" || /^https?:\/\//i.test(url)) ? url : "#";
    cta.setAttribute("aria-label", text);
    return cta;
  }

  function renderCloseButton(card, design) {
    var button = document.createElement("button");
    var size = clamp((design || {}).closeButtonSize, 10, 48, 20);

    button.className = "pp-close";
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.style.setProperty("--pp-close-size", size + "px");
    button.innerHTML = closeIconSvg(size);
    button.addEventListener("click", function () {
      if ((design || {}).dismissBehavior === "HIDE_PERMANENTLY") {
        rememberCampaignDismissed(card.dataset.campaignId);
      }
      removeProductCard(card, design);
    });

    return button;
  }

  function closeIconSvg(size) {
    return (
      '<svg class="pp-close__icon" viewBox="0 0 24 24" width="' +
      size +
      '" height="' +
      size +
      '" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" aria-hidden="true" focusable="false">' +
      '<line x1="6" y1="6" x2="18" y2="18"></line>' +
      '<line x1="18" y1="6" x2="6" y2="18"></line></svg>'
    );
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
      (campaign.freeShipping || {}).progressStyle || "BAR",
    ).toUpperCase();

    return style === "COMPACT" || style === "CIRCULAR" ? style : "BAR";
  }

  function renderCountdown(ms, design, compact) {
    var timerStyle = safeTimerStyle(design.timerStyle);
    var timerFormat = safeTimerFormat(design.timerFormat);
    var countdown = document.createElement(
      compact && timerStyle === "PLAIN" ? "span" : "div",
    );

    countdown.className =
      "pp-countdown pp-countdown--" +
      timerStyle.toLowerCase() +
      " pp-countdown--" +
      timerFormat.toLowerCase() +
      (design.timerNumberLayout === "STACKED"
        ? " pp-countdown--stacked"
        : "") +
      (compact ? " pp-countdown--compact" : "") +
      timerTickClass(design);
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
    var previousUnitValues;
    var tickAnimation;

    if (!visibleParts.length) {
      visibleParts = [parts[parts.length - 1]];
    }

    if (timerFormat === "COLON") {
      nextText = formatTimerPartsAsColon(visibleParts);
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

    previousUnitValues = readCountdownUnitValues(countdown);
    tickAnimation = getCountdownTickAnimation(countdown);
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
    if (!card.querySelector("[data-cp-timer]")) return;

    card.__promoPulseTimerInterval = window.setInterval(function () {
      var state = calculateTimerState(campaign, new Date());
      var countdown = card.querySelector("[data-cp-timer]");
      var subheadline = card.querySelector(
        ".counterpulse-preview-message-copy > span",
      );
      var expiredBehavior = getExpiredBehavior(campaign);
      var expiredText = (campaign.texts || {}).expiredText || "";

      if (!countdown) return;
      if (state.isExpired) {
        countdown.remove();
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

      window.CountPulseSurface.updateTimer(
        countdown,
        state.remainingMs,
        campaign.design || {},
      );
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

  function normalizeLayout(value) {
    var layout = String(value || "STANDARD")
      .toLowerCase()
      .replace(/_/g, "-");

    if (
      layout === "balanced" ||
      layout === "inline" ||
      layout === "cta-right" ||
      layout === "cta-left" ||
      layout === "cta-top"
    ) {
      return layout;
    }

    return "standard";
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
    if (!countdown) return;

    [].slice
      .call(countdown.querySelectorAll(".pp-countdown-tick-value"))
      .forEach(function (value) {
        value.classList.remove("pp-countdown-tick-value");
        void value.offsetWidth;
        value.classList.add("pp-countdown-tick-value");
      });
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
    } catch {
      return {};
    }
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

  function buildTimerParts(ms, design) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var showDays = !design || design.timerHideZeroDays === false || days > 0;
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var parts = [];

    if (showDays) {
      parts.push(
        timerPart("days", days, timerUnitLabel(design, "days"), "Days"),
      );
    }

    parts.push(
      timerPart(
        "hours",
        showDays ? hours : Math.floor(totalSeconds / 3600),
        timerUnitLabel(design, "hours"),
        "Hrs",
      ),
    );
    parts.push(
      timerPart("minutes", minutes, timerUnitLabel(design, "minutes"), "Mins"),
    );
    parts.push(
      timerPart("seconds", seconds, timerUnitLabel(design, "seconds"), "Secs"),
    );

    return parts;
  }

  function timerPart(key, value, label, shortLabel) {
    return {
      key: key,
      value: pad(value),
      label: label,
      shortLabel: shortLabel,
    };
  }

  function formatTimerPartsAsColon(parts) {
    return parts
      .map(function (part) {
        return part.value;
      })
      .join(":");
  }

  function safeTimerStyle(value) {
    return value === "GROUPED" || value === "BOXES" ? value : "PLAIN";
  }

  function safeTimerFormat(value) {
    return value === "COLON" ? "COLON" : "UNITS";
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
