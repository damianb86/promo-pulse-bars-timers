(function () {
  "use strict";

  var root = document.getElementById("promo-pulse-app-embed");
  if (!root) return;

  var config = {
    shop: detectShop(root),
    path: window.location.pathname,
    locale: detectLocale(root),
    country: detectCountry(root),
    market: detectMarket(root),
    currency: detectCurrency(root),
    productId: root.dataset.productId || "",
    productTags: splitList(root.dataset.productTags),
    collectionIds: splitList(root.dataset.collectionIds),
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
  var globalPlacements = "TOP_BAR,BOTTOM_BAR,CUSTOM_SELECTOR";

  if (!config.shop) {
    updateDebug(root, "Embed detenido: falta el shop domain.");
    return;
  }

  updateDebug(
    root,
    "Embed JS cargado. Consultando placements globales; cart drawer, free shipping y delivery cutoff los manejan assets dedicados.",
  );

  fetchCampaigns(globalPlacements)
    .then(function (campaigns) {
      updateDebug(
        root,
        "API global OK: " +
          campaigns.length +
          " campana(s) recibidas para placements globales.",
      );
      campaigns.forEach(function (campaign) {
        renderCampaign(campaign);
      });
    })
    .catch(function (error) {
      updateDebug(root, "Error global del embed: " + error.message);
      debug(error);
    });

  renderInlineSnippets();

  function fetchCampaigns(placement, campaignId) {
    var url = buildCampaignUrl(placement, campaignId);
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

  function buildCampaignUrl(placement, campaignId) {
    var params = new URLSearchParams({
      shop: config.shop,
      path: config.path,
      locale: config.locale,
      device: config.device,
      placement: placement,
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
    if (config.utmSource) params.set("utmSource", config.utmSource);
    if (campaignId) params.set("campaignId", campaignId);
    appendBehaviorTargetingParams(params);

    return config.apiPath + "?" + params.toString();
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
    var value = (window.PromoPulseApiBaseUrl || apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");

    if (!/^https?:\/\//i.test(value)) return "/apps/promo-pulse";
    if (/\/api\/storefront\/campaigns$/i.test(value)) return value;

    return value + "/api/storefront/campaigns";
  }

  function renderInlineSnippets() {
    [].slice
      .call(document.querySelectorAll("[data-promo-pulse-campaign-id]"))
      .forEach(function (slot, index) {
        var campaignId = slot.dataset.promoPulseCampaignId || "";
        var placement = slot.dataset.promoPulsePlacement || "";

        if (
          placement !== "CUSTOM_SELECTOR" ||
          !campaignId ||
          slot.dataset.promoPulseRenderStarted === "true"
        ) {
          return;
        }

        slot.dataset.promoPulseRenderStarted = "true";
        slot.dataset.promoPulseSlotIndex = String(index);

        fetchCampaigns("CUSTOM_SELECTOR", campaignId).then(
          function (campaigns) {
            if (campaigns[0]) {
              renderCampaign(campaigns[0], slot);
            }
          },
        );
      });
  }

  function renderCampaign(campaign, targetContainer) {
    if (
      !campaign ||
      !campaign.placement ||
      campaign.type === "FREE_SHIPPING_GOAL" ||
      campaign.type === "DELIVERY_CUTOFF"
    )
      return;

    var design = campaign.design || {};
    var timerState = calculateTimerState(campaign, new Date());
    var icon;

    if (design.mobileEnabled === false && config.device === "mobile") return;
    if (timerState.isExpired && shouldHideExpiredCampaign(campaign)) return;
    var renderKey =
      (targetContainer
        ? "snippet:" + targetContainer.dataset.promoPulseSlotIndex
        : campaign.placement) +
      ":" +
      campaign.id;

    if (renderedCampaigns[renderKey]) return;

    var bar = document.createElement("section");
    var container = targetContainer
      ? getSnippetContainer(targetContainer)
      : getPlacementContainer(campaign.placement, campaign.placementSelector);

    if (!container) return;

    bar.className =
      "pp-bar pp-bar--" + campaign.placement.toLowerCase().replace(/_/g, "-");
    bar.classList.add(
      "pp-bar--layout-" + String(design.layout || "STANDARD").toLowerCase(),
    );
    if (design.fullWidth) bar.classList.add("pp-bar--full-width");
    if (design.positionMode === "OVERLAY") bar.classList.add("pp-bar--overlay");
    if (design.entranceAnimation && design.entranceAnimation !== "NONE") {
      bar.classList.add(
        "pp-bar--enter-" + String(design.entranceAnimation).toLowerCase(),
      );
    }
    if (design.exitAnimation && design.exitAnimation !== "NONE") {
      bar.classList.add(
        "pp-bar--exit-" + String(design.exitAnimation).toLowerCase(),
      );
    }
    bar.dataset.campaignId = campaign.id;
    bar.dataset.testid = "promo-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute(
      "aria-label",
      ((campaign.texts || {}).headline || "Promo Pulse promotion").trim(),
    );
    setDesignProperties(bar, design);

    if (
      campaign.placement === "TOP_BAR" &&
      design.positionMode !== "OVERLAY" &&
      design.positionSticky
    ) {
      bar.classList.add("pp-bar--sticky");
    }

    icon = renderIcon(design);
    bar.appendChild(renderMessage(campaign, timerState, icon));

    if (
      timerState.isActive &&
      String(design.layout || "").toUpperCase() !== "INLINE"
    ) {
      bar.appendChild(renderCountdown(timerState, design));
    }

    if (
      !timerState.isExpired &&
      campaign.discount &&
      (campaign.discount.discountCode || campaign.discount.uniqueCode) &&
      typeof window.PromoPulseCouponButton === "function"
    ) {
      bar.appendChild(
        window.PromoPulseCouponButton(campaign.discount.discountCode, campaign),
      );
    }

    if (
      !timerState.isExpired &&
      design.showButton !== false &&
      (campaign.texts || {}).ctaText
    ) {
      bar.appendChild(
        renderCta(campaign.texts.ctaText, campaign.texts.ctaUrl, campaign),
      );
    }

    if (design.showCloseButton) {
      bar.appendChild(renderCloseButton(bar, design));
    }

    container.appendChild(bar);
    renderedCampaigns[renderKey] = true;
    startCountdown(bar, campaign);
    emitImpression(campaign);
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
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
    bar.style.setProperty("--pp-bg", getBackground(design));
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
      "--pp-close",
      safeColor(
        design.closeButtonColor,
        safeColor(design.textColor, "#ffffff"),
      ),
    );
    bar.style.setProperty(
      "--pp-font-size",
      clamp(design.fontSize, 10, 24, 14) + "px",
    );
    bar.style.setProperty("--pp-font-family", fontFamily(design.fontFamily));
    bar.style.setProperty(
      "--pp-radius",
      clamp(design.borderRadius, 0, 999, 0) + "px",
    );
    bar.style.setProperty(
      "--pp-border-size",
      clamp(design.borderSize, 0, 8, 0) + "px",
    );
    bar.style.setProperty(
      "--pp-border-color",
      safeColor(design.borderColor, "transparent"),
    );
    bar.style.setProperty(
      "--pp-title-size",
      clamp(design.titleFontSize, 12, 48, 18) + "px",
    );
    bar.style.setProperty(
      "--pp-title-color",
      safeColor(design.titleColor, safeColor(design.textColor, "#ffffff")),
    );
    bar.style.setProperty(
      "--pp-subheading-size",
      clamp(design.subheadingFontSize, 10, 32, 14) + "px",
    );
    bar.style.setProperty(
      "--pp-subheading-color",
      safeColor(design.subheadingColor, safeColor(design.textColor, "#ffffff")),
    );
    bar.style.setProperty(
      "--pp-timer-size",
      clamp(design.timerFontSize, 12, 72, 24) + "px",
    );
    bar.style.setProperty(
      "--pp-timer-color",
      safeColor(design.timerColor, safeColor(design.textColor, "#ffffff")),
    );
    bar.style.setProperty(
      "--pp-legend-size",
      clamp(design.legendFontSize, 10, 24, 12) + "px",
    );
    bar.style.setProperty(
      "--pp-legend-color",
      safeColor(design.legendColor, safeColor(design.textColor, "#ffffff")),
    );
    bar.style.setProperty(
      "--pp-timer-surface",
      safeColor(design.timerSurfaceColor, "rgba(255,255,255,.12)"),
    );
    bar.style.setProperty(
      "--pp-timer-border",
      safeColor(design.timerSurfaceBorderColor, "transparent"),
    );
    bar.style.setProperty(
      "--pp-timer-border-size",
      clamp(design.timerSurfaceBorderSize, 0, 6, 0) + "px",
    );
    bar.style.setProperty(
      "--pp-timer-radius",
      clamp(design.timerSurfaceRadius, 0, 40, 8) + "px",
    );
    bar.style.setProperty(
      "--pp-content-max-width",
      clamp(design.contentMaxWidth, 280, 1440, 960) + "px",
    );
    bar.style.setProperty(
      "--pp-padding-block",
      clamp(design.paddingBlock, 4, 48, 11) + "px",
    );
    bar.style.setProperty(
      "--pp-padding-inline",
      clamp(design.paddingInline, 8, 64, 16) + "px",
    );
    bar.style.setProperty("--pp-justify", getJustifyContent(design.alignment));
    bar.style.setProperty("--pp-align", getTextAlign(design.alignment));
    bar.style.setProperty(
      "--pp-gap",
      clamp(design.contentGap, 4, 48, 10) + "px",
    );
    bar.style.setProperty(
      "--pp-icon-size",
      clamp(design.iconSize, 12, 64, 20) + "px",
    );
    bar.style.setProperty(
      "--pp-motion-duration",
      clamp(design.animationDurationMs, 0, 1500, 220) + "ms",
    );
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
        safeColor(design.gradientStartColor, "#252237") +
        ", " +
        safeColor(design.gradientEndColor, "#4c4861") +
        ")"
      );
    }

    return safeColor(design.backgroundColor, "#111827");
  }

  function escapeCssUrl(value) {
    return String(value || "").replace(/["\\\n\r]/g, "");
  }

  function getPlacementContainer(placement, selector) {
    var target;
    var customContainer;
    var id = placement === "BOTTOM_BAR" ? "pp-bottom-bars" : "pp-top-bars";
    var existingContainer = document.getElementById(id);
    var container;

    if (placement === "CUSTOM_SELECTOR") {
      target = queryCustomPlacementTarget(selector);

      if (!target) return null;

      customContainer = document.createElement("div");
      customContainer.className = "pp-container pp-container--custom-selector";
      target.appendChild(customContainer);

      return customContainer;
    }

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

  function getSnippetContainer(target) {
    var container = document.createElement("div");

    container.className =
      "pp-container pp-container--custom-selector pp-container--snippet";
    target.appendChild(container);

    return container;
  }

  function queryCustomPlacementTarget(selector) {
    if (!selector || typeof selector !== "string") {
      updateDebug(root, "CUSTOM_SELECTOR omitido: falta el selector.");
      return null;
    }

    try {
      return document.querySelector(selector);
    } catch (error) {
      updateDebug(root, "CUSTOM_SELECTOR invalido: " + selector);
      debug(selector, error);
      return null;
    }
  }

  function renderIcon(design) {
    var icon = document.createElement("span");
    var svg;
    var image;

    if (design.icon === "NONE") return null;

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

  function renderMessage(campaign, timerState, icon) {
    var texts = campaign.texts || {};
    var message = document.createElement("div");
    var copy = document.createElement("div");
    var headline = document.createElement("strong");
    var subheadline = document.createElement("span");
    var design = campaign.design || {};
    var isInline = String(design.layout || "").toUpperCase() === "INLINE";

    message.className = "pp-message";
    copy.className = "pp-message-copy";
    if (icon) message.appendChild(icon);

    headline.textContent = texts.headline || campaign.name || "Ad";
    copy.appendChild(headline);

    if (timerState.isExpired && texts.expiredText) {
      subheadline.textContent = texts.expiredText;
      copy.appendChild(subheadline);
    } else if (texts.subheadline) {
      subheadline.textContent = texts.subheadline;
      copy.appendChild(subheadline);
    }

    if (timerState.isActive && isInline) {
      copy.appendChild(renderCountdown(timerState, design, true));
    }

    message.appendChild(copy);

    return message;
  }

  function renderCountdown(timerState, design, compact) {
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
    updateCountdownElement(countdown, timerState.remainingMs, design, compact);
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

  function renderCta(text, url, campaign) {
    var cta = document.createElement("a");

    cta.className = "pp-cta";
    cta.href = isSafeUrl(url) ? url : "#";
    cta.textContent = text;
    cta.setAttribute("aria-label", text);
    cta.addEventListener("click", function () {
      document.dispatchEvent(
        new CustomEvent("promo-pulse:click", {
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

  function renderCloseButton(bar, design) {
    var button = document.createElement("button");

    button.className = "pp-close";
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.innerHTML = "&times;";
    button.addEventListener("click", function () {
      removeBar(bar, design);
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
    } catch (error) {
      return {};
    }
  }

  function getExpiredBehavior(campaign) {
    return (campaign.timer || {}).expiredBehavior || "UNPUBLISH_TIMER";
  }

  function shouldHideExpiredCampaign(campaign) {
    var behavior = getExpiredBehavior(campaign);
    return behavior === "UNPUBLISH_TIMER" || behavior === "HIDE_TIMER";
  }

  function startCountdown(bar, campaign) {
    if (!bar.querySelector(".pp-countdown")) return;

    window.setInterval(function () {
      var timerState = calculateTimerState(campaign, new Date());
      var countdown = bar.querySelector(".pp-countdown");
      var subheadline = bar.querySelector(
        ".pp-message-copy > span:not(.pp-countdown)",
      );
      var expiredText = (campaign.texts || {}).expiredText || "";
      var expiredBehavior = getExpiredBehavior(campaign);

      if (!countdown) return;

      if (timerState.isExpired) {
        countdown.remove();
        bar.classList.add("pp-bar--expired");

        if (expiredBehavior === "SHOW_CUSTOM_TITLE" && expiredText) {
          if (!subheadline) {
            subheadline = document.createElement("span");
            bar.querySelector(".pp-message-copy")?.appendChild(subheadline);
          }
          subheadline.textContent = expiredText;
        } else if (
          expiredBehavior === "HIDE_TIMER" ||
          expiredBehavior === "UNPUBLISH_TIMER"
        ) {
          removeBar(bar, campaign.design || {});
        }

        return;
      }

      var previousValue = countdown.dataset.value || "";
      updateCountdownElement(
        countdown,
        timerState.remainingMs,
        campaign.design || {},
        countdown.classList.contains("pp-countdown--compact"),
      );
      if (countdown.dataset.value !== previousValue) {
        replayCountdownTick(countdown);
      }
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
    var key = "promo_pulse_deadline_" + campaign.id;
    var stored = readStorage(storage, key);
    var startedAt = parseDate(stored && stored.startedAt);
    var endsAt = parseDate(stored && stored.endsAt);

    if (
      startedAt &&
      endsAt &&
      shouldReuseStorage(
        startedAt,
        now,
        campaign.timezone,
        timer.resetBehavior,
      ) &&
      !(
        timer.expiredBehavior === "REPEAT_COUNTDOWN" &&
        endsAt.getTime() <= now.getTime()
      )
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

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function isSafeIconUrl(value) {
    return (
      typeof value === "string" &&
      (value.charAt(0) === "/" ||
        /^https?:\/\//i.test(value) ||
        /^data:image\/(?:svg\+xml|png|jpe?g);base64,/i.test(value))
    );
  }

  function isSafeImageUrl(value) {
    return (
      typeof value === "string" &&
      (value.charAt(0) === "/" || /^https?:\/\//i.test(value))
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

    window.PromoPulseSettings = settings;
    config.debugMode = settings.enableDebugMode === true || config.debugMode;

    if (settings.defaultLocale && !config.locale) {
      config.locale = settings.defaultLocale;
    }
    config.currency = config.currency || settings.defaultCurrency || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
