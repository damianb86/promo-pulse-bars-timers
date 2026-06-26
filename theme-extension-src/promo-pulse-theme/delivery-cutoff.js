(function () {
  "use strict";

  var embed = document.getElementById("promo-pulse-app-embed");
  var device = detectDevice();

  if (embed) initEmbed(embed);
  [].slice
    .call(document.querySelectorAll(".pp-product-timer"))
    .forEach(initProduct);

  function initEmbed(root) {
    var config = {
      country:
        root.dataset.country ||
        (window.Shopify && window.Shopify.country) ||
        "",
      market: root.dataset.market || detectMarket(),
      currency: root.dataset.cartCurrency || detectCurrency(),
      debug: root.dataset.debug === "true",
      locale:
        root.dataset.locale ||
        root.dataset.defaultLocale ||
        document.documentElement.lang ||
        "en",
      path: window.location.pathname,
      device: device,
      shop:
        root.dataset.shop ||
        (window.Shopify && window.Shopify.shop) ||
        window.location.hostname,
      productId: root.dataset.productId || "",
      productTags: split(root.dataset.productTags),
      apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };

    if (!config.shop) {
      updateDebug(root, "Delivery cutoff detenido: falta el shop domain.");
      return;
    }
    fetchCampaigns(config, "TOP_BAR,BOTTOM_BAR", root).then(
      function (campaigns) {
        if (!campaigns.length) {
          updateDebug(
            root,
            "API OK: 0 campanas DELIVERY_CUTOFF elegibles para placements globales.",
          );
        }
        campaigns.forEach(function (campaign) {
          renderGlobal(campaign, config);
        });
      },
    );
  }

  function initProduct(root) {
    var config = {
      campaignId: root.dataset.campaignId || "",
      country: root.dataset.country || "",
      market: root.dataset.market || detectMarket(),
      currency: root.dataset.cartCurrency || detectCurrency(),
      debug: root.dataset.debug === "true",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      locale: root.dataset.locale || document.documentElement.lang || "en",
      path: window.location.pathname,
      device: device,
      productId: root.dataset.productId || "",
      productTags: split(root.dataset.productTags),
      shop: root.dataset.shop || (window.Shopify && window.Shopify.shop) || "",
      apiBaseUrl: root.dataset.apiBaseUrl || window.PromoPulseApiBaseUrl || "",
    };

    if (!config.shop) {
      updateDebug(root, "Delivery cutoff detenido: falta el shop domain.");
      return;
    }
    if (!config.productId) {
      updateDebug(
        root,
        "Delivery cutoff detenido: Shopify no expuso productId en este contexto.",
      );
      return;
    }
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && !config.campaignId) {
      updateDebug(
        root,
        "Delivery cutoff detenido: Specific campaign requiere un Campaign ID.",
      );
      return;
    }

    fetchCampaigns(config, "PRODUCT_PAGE", root).then(function (campaigns) {
      if (campaigns[0]) {
        renderProduct(root, campaigns[0], config);
      } else {
        updateDebug(
          root,
          "API OK: 0 campanas DELIVERY_CUTOFF elegibles para PRODUCT_PAGE.",
        );
      }
    });
  }

  function buildUrl(config, placement) {
    var params = new URLSearchParams({
      locale: config.locale,
      path: config.path,
      device: config.device || device,
      placement: placement,
      shop: config.shop,
    });

    if (config.country) params.set("country", config.country);
    if (config.market) params.set("market", config.market);
    if (config.currency) params.set("currency", config.currency);
    if (config.productId) params.set("productId", config.productId);
    if (config.productTags && config.productTags.length) {
      params.set("productTags", config.productTags.join(","));
    }
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && config.campaignId) {
      params.set("campaignId", config.campaignId);
    }
    appendBehaviorTargetingParams(params);

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

  function fetchCampaigns(config, placement, debugRoot) {
    var url = buildUrl(config, placement);
    var campaignId =
      config.fallbackMode === "SPECIFIC_CAMPAIGN" ? config.campaignId : "";

    updateDebug(
      debugRoot,
      "Consultando DELIVERY_CUTOFF " + placement + ".",
      url,
    );

    if (window.PromoPulseFetchCampaigns) {
      return window
        .PromoPulseFetchCampaigns(config, placement, {
          campaignId: campaignId,
        })
        .then(function (payload) {
          applyStorefrontSettings(config, payload.settings);
          return (Array.isArray(payload.campaigns) ? payload.campaigns : [])
            .map(applyExperiment)
            .filter(function (campaign) {
              return campaign.type === "DELIVERY_CUTOFF";
            });
        })
        .then(function (campaigns) {
          updateDebug(
            debugRoot,
            "API OK: " +
              campaigns.length +
              " campana(s) DELIVERY_CUTOFF para " +
              placement +
              ".",
            url,
          );
          return campaigns;
        })
        .catch(function (error) {
          updateDebug(
            debugRoot,
            "Error DELIVERY_CUTOFF " + placement + ": " + error.message,
            url,
          );
          if (config.debug && window.console)
            console.log("[CP delivery]", error);
          return [];
        });
    }

    return fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(config, payload.settings);
        return (Array.isArray(payload.campaigns) ? payload.campaigns : [])
          .map(applyExperiment)
          .filter(function (campaign) {
            return campaign.type === "DELIVERY_CUTOFF";
          });
      })
      .then(function (campaigns) {
        updateDebug(
          debugRoot,
          "API OK: " +
            campaigns.length +
            " campana(s) DELIVERY_CUTOFF para " +
            placement +
            ".",
          url,
        );
        return campaigns;
      })
      .catch(function (error) {
        updateDebug(
          debugRoot,
          "Error DELIVERY_CUTOFF " + placement + ": " + error.message,
          url,
        );
        if (config.debug && window.console) console.log("[CP delivery]", error);
        return [];
      });
  }

  function applyExperiment(campaign) {
    if (window.PromoPulseApplyExperiment) {
      return window.PromoPulseApplyExperiment(campaign);
    }

    return campaign;
  }

  function renderGlobal(campaign, config) {
    var promise = deliveryPromise(
      campaign.deliveryCutoff,
      campaign.timezone,
      config.locale,
      campaign.design || {},
    );
    var existing = document.getElementById(
      "promo-pulse-delivery-" + campaign.placement,
    );
    var container;
    var bar;

    if (!shouldRender(campaign, promise)) {
      if (existing) existing.remove();
      updateDebug(
        embed,
        "Delivery cutoff recibido, pero oculto por mobileEnabled=false o afterCutoffBehavior=HIDE.",
      );
      return;
    }

    if (!window.CountPulseSurface) return;

    container = getContainer(campaign.placement);
    bar = buildSurface(
      campaign.placement === "TOP_BAR" || campaign.placement === "BOTTOM_BAR"
        ? "bar"
        : "block",
      campaign,
      promise,
    );
    bar.id = "promo-pulse-delivery-" + campaign.placement;

    if (
      campaign.placement === "TOP_BAR" &&
      (campaign.design || {}).positionMode !== "OVERLAY" &&
      (campaign.design || {}).positionSticky
    ) {
      bar.classList.add("counterpulse-preview-promo--sticky");
    }

    if (existing) existing.replaceWith(bar);
    else container.appendChild(bar);
    tick(bar, campaign, config, function () {
      renderGlobal(campaign, config);
    });
    emit(campaign);
  }

  function renderProduct(root, campaign, config) {
    var promise = deliveryPromise(
      campaign.deliveryCutoff,
      campaign.timezone,
      config.locale,
      campaign.design || {},
    );
    var card;

    if (!shouldRender(campaign, promise)) {
      updateDebug(
        root,
        "Delivery cutoff recibido, pero oculto por mobileEnabled=false o afterCutoffBehavior=HIDE.",
      );
      if (!config.debug) root.replaceChildren();
      return;
    }

    if (!window.CountPulseSurface) return;

    card = buildSurface("block", campaign, promise);
    root.replaceChildren(card);
    tick(card, campaign, config, function () {
      renderProduct(root, campaign, config);
    });
    emit(campaign);
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

  function deliveryClock(ms) {
    var total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    function pad(value) {
      return String(value).padStart(2, "0");
    }
    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  function buildSurface(variant, campaign, promise) {
    var design = campaign.design || {};
    var texts = campaign.texts || {};

    if (!window.CountPulseSurface) return document.createElement("section");

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

    var surface = window.CountPulseSurface.build({
      variant: variant,
      placement: campaign.placement,
      design: design,
      headline: texts.headline || "Delivery promise",
      body: deliveryMessage(campaign, promise),
      deliveryTime: promise.beforeCutoff ? deliveryClock(promise.remainingMs) : null,
      hasTimer: promise.beforeCutoff,
      couponNode: couponNode,
      cta: design.showButton !== false ? texts.ctaText || "" : "",
      ctaUrl: texts.ctaUrl || "",
      dataTestId: "delivery-cutoff-widget",
      onClose: function () {
        surface.remove();
      },
    });

    surface.dataset.campaignId = campaign.id;
    if (design.mobileEnabled === false && device === "mobile") {
      surface.hidden = true;
    }

    return surface;
  }

  function deliveryMessage(campaign, promise) {
    var texts = campaign.texts || {};
    var template;

    if (promise.beforeCutoff) {
      template =
        texts.deliveryBeforeCutoffText ||
        "Order within {{time_left}} to get it by {{max_delivery_weekday}}";
    } else if (promise.behavior === "SHOW_AFTER_CUTOFF_MESSAGE") {
      template =
        texts.deliveryAfterCutoffText ||
        "Orders placed now ship {{ships_weekday}}";
    } else {
      template = "Order today and get it between {{delivery_range}}";
    }

    return template.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      function (match, key) {
        return promise.vars[key] || match;
      },
    );
  }

  function shouldRender(campaign, promise) {
    return !(
      ((campaign.design || {}).mobileEnabled === false &&
        device === "mobile") ||
      (!promise.beforeCutoff && promise.behavior === "HIDE")
    );
  }

  function deliveryPromise(settings, timezone, locale, design) {
    settings = settings || {};
    var tz = safeTz(timezone);
    var now = new Date();
    var today = localDate(parts(now, tz));
    var work = workDays(settings.workingDays);
    var holiday = holidays(settings.holidays);
    var cutoff = zdt(
      today.y,
      today.m,
      today.d,
      num(settings.cutoffHour, 14),
      num(settings.cutoffMinute, 0),
      tz,
    );
    var before =
      isWork(today, work, holiday) && now.getTime() < cutoff.getTime();
    var base = before ? today : nextWork(addDays(today, 1), work, holiday);
    var ship = addWork(base, num(settings.processingDays, 0), work, holiday);
    var min = addWork(ship, num(settings.minDeliveryDays, 2), work, holiday);
    var max = addWork(
      ship,
      Math.max(
        num(settings.minDeliveryDays, 2),
        num(settings.maxDeliveryDays, 5),
      ),
      work,
      holiday,
    );
    var left = before ? Math.max(0, cutoff.getTime() - now.getTime()) : 0;

    return {
      beforeCutoff: before,
      behavior: settings.afterCutoffBehavior || "SHOW_NEXT_WINDOW",
      remainingMs: left,
      vars: vars(locale, tz, cutoff, left, ship, min, max, design),
    };
  }

  function vars(locale, timezone, cutoff, left, ship, min, max, design) {
    var date = new Intl.DateTimeFormat(locale || "en", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    var weekday = new Intl.DateTimeFormat(locale || "en", {
      timeZone: "UTC",
      weekday: "long",
    });
    var time = new Intl.DateTimeFormat(locale || "en", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    });
    var minText = date.format(display(min));
    var maxText = date.format(display(max));
    var leftText = fmt(left, design);

    return {
      cutoff_time: time.format(cutoff),
      delivery_range: minText + "-" + maxText,
      max_delivery_date: maxText,
      max_delivery_weekday: weekday.format(display(max)),
      min_delivery_date: minText,
      min_delivery_weekday: weekday.format(display(min)),
      ships_date: date.format(display(ship)),
      ships_weekday: weekday.format(display(ship)),
      time_left: leftText,
      time_remaining: leftText,
    };
  }

  function tick(surface, campaign, config, rerender) {
    if (!surface.querySelector("[data-cp-timer]")) return;
    var id = window.setInterval(function () {
      if (!surface.isConnected) {
        window.clearInterval(id);
        return;
      }
      var promise = deliveryPromise(
        campaign.deliveryCutoff,
        campaign.timezone,
        config.locale,
        campaign.design || {},
      );
      var countdown = surface.querySelector("[data-cp-timer]");
      if (!promise.beforeCutoff) {
        window.clearInterval(id);
        rerender();
      } else if (countdown && window.CountPulseSurface) {
        window.CountPulseSurface.updateTimerFromText(
          countdown,
          deliveryClock(promise.remainingMs),
          campaign.design || {},
        );
      }
    }, 1000);
  }

  function getContainer(placement) {
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
    if (placement === "BOTTOM_BAR")
      (configuredTarget || document.body).appendChild(container);
    else if (configuredTarget)
      configuredTarget.insertBefore(container, configuredTarget.firstChild);
    else document.body.insertBefore(container, document.body.firstChild);
    return container;
  }

  function getConfiguredSelector(placement) {
    var settings = window.PromoPulseSettings || {};

    if (placement === "TOP_BAR") return settings.customTopBarSelector || "";
    if (placement === "BOTTOM_BAR")
      return settings.customBottomBarSelector || "";

    return "";
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
      } catch {
        target = null;
      }
    }

    return null;
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
      clamp(design.paddingBlock, 4, 48, 11) + "px",
    );
    element.style.setProperty(
      "--pp-padding-inline",
      clamp(design.paddingInline, 8, 64, 16) + "px",
    );
    element.style.setProperty("--pp-justify", justify(design.alignment));
    element.style.setProperty("--pp-align", align(design.alignment));
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
  }

  function parts(date, timezone) {
    var values = {};
    var weekdays = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
    })
      .formatToParts(date)
      .forEach(function (part) {
        values[part.type] = part.value;
      });
    return {
      d: Number(values.day),
      h: Number(values.hour),
      i: weekdays[values.weekday] || 1,
      m: Number(values.month),
      n: Number(values.minute),
      s: Number(values.second),
      y: Number(values.year),
    };
  }

  function zdt(year, month, day, hour, minute, timezone) {
    var local = Date.UTC(year, month - 1, day, hour, minute, 0);
    var utc = local;
    for (var index = 0; index < 3; index += 1) {
      utc = local - (stamp(new Date(utc), timezone) - utc);
    }
    return new Date(utc);
  }

  function stamp(date, timezone) {
    var p = parts(date, timezone);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.n, p.s);
  }

  function localDate(p) {
    return { d: p.d, i: p.i, m: p.m, y: p.y };
  }

  function addWork(date, days, work, holiday) {
    if (days <= 0)
      return isWork(date, work, holiday) ? date : nextWork(date, work, holiday);
    while (days > 0) {
      date = addDays(date, 1);
      if (isWork(date, work, holiday)) days -= 1;
    }
    return date;
  }

  function nextWork(date, work, holiday) {
    for (var index = 0; index < 370; index += 1) {
      if (isWork(date, work, holiday)) return date;
      date = addDays(date, 1);
    }
    return date;
  }

  function addDays(date, days) {
    var next = new Date(Date.UTC(date.y, date.m - 1, date.d + days, 12));
    var weekday = next.getUTCDay();
    return {
      d: next.getUTCDate(),
      i: weekday === 0 ? 7 : weekday,
      m: next.getUTCMonth() + 1,
      y: next.getUTCFullYear(),
    };
  }

  function isWork(date, work, holiday) {
    return (
      work.has(date.i) &&
      !holiday.has(date.y + "-" + pad(date.m) + "-" + pad(date.d))
    );
  }

  function workDays(value) {
    var set = new Set(
      Array.isArray(value) ? value.map(Number) : [1, 2, 3, 4, 5],
    );
    return set.size ? set : new Set([1, 2, 3, 4, 5]);
  }

  function holidays(value) {
    return new Set(Array.isArray(value) ? value : []);
  }

  function display(date) {
    return new Date(Date.UTC(date.y, date.m - 1, date.d, 12));
  }

  function fmt(ms, design) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(total / 86400);
    var h = Math.floor((total % 86400) / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var units;

    if (design && design.timerFormat === "UNITS") {
      units = [];
      if (days > 0) units.push(formatTimerUnit(days, "Day", design));
      units.push(
        formatTimerUnit(days > 0 ? h : Math.floor(total / 3600), "Hr", design),
      );
      units.push(formatTimerUnit(m, "Min", design));
      if (!design || design.timerShowSeconds !== false) {
        units.push(formatTimerUnit(s, "Sec", design));
      }
      return units.join(" ");
    }

    if (design && design.timerShowSeconds === false) {
      if (days > 0) return [pad(days), pad(h), pad(m)].join(":");
      return pad(h) + ":" + pad(m);
    }

    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function formatTimerUnit(value, label, design) {
    if (design && design.timerShowLabels === false) return pad(value);
    return pad(value) + " " + label + (value === 1 ? "" : "s");
  }

  function safeTz(timezone) {
    try {
      Intl.DateTimeFormat(void 0, { timeZone: timezone });
      return timezone;
    } catch {
      return "UTC";
    }
  }

  function split(value) {
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

  function renderCountdown(remainingMs, design) {
    // Reuse the app embed's canonical timer renderer so the cutoff countdown
    // honors the configured Timer Type (units/colon, boxes/grouped, labels,
    // colors). Fall back to flat text when the embed isn't on the page.
    if (typeof window.PromoPulseRenderCountdown === "function") {
      return window.PromoPulseRenderCountdown(remainingMs, design || {}, false);
    }

    var countdown = node("span", "pp-countdown", fmt(remainingMs, design || {}));

    countdown.setAttribute("aria-live", "polite");
    countdown.setAttribute("aria-label", "Time remaining");

    return countdown;
  }

  function link(className, text, href) {
    var anchor = node("a", className, text);
    anchor.href = href;
    return anchor;
  }

  function close(surface) {
    var button = document.createElement("button");
    button.className = "pp-close";
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.innerHTML = "&times;";
    button.addEventListener("click", function () {
      surface.remove();
    });
    return button;
  }

  function emit(campaign) {
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

  function safeUrl(url) {
    return url ? url.charAt(0) === "/" || /^https?:\/\//i.test(url) : false;
  }

  function num(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
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
