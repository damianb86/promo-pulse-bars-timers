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
      if (campaigns.length) {
        renderProductAll(root, campaigns, config);
      } else {
        getRenderSlot(root, "delivery").replaceChildren();
        updateDebug(
          root,
          "API OK: 0 campanas DELIVERY_CUTOFF elegibles para PRODUCT_PAGE.",
        );
      }
    });
  }

  // Dedicated render slot inside the shared .pp-product-timer block so the
  // delivery-cutoff asset does not clobber the timer/low-stock assets when
  // several campaigns target PRODUCT_PAGE at once.
  function getRenderSlot(root, name) {
    var slot = root.querySelector('[data-pp-slot="' + name + '"]');
    if (!slot) {
      slot = document.createElement("div");
      slot.setAttribute("data-pp-slot", name);
      slot.className = "pp-render-slot pp-render-slot--" + name;
      root.appendChild(slot);
    }
    return slot;
  }

  function renderProductAll(root, campaigns, config) {
    var slot = getRenderSlot(root, "delivery");
    var entries = [];

    if (!window.CountPulseSurface) return;

    campaigns.forEach(function (campaign) {
      var promise = deliveryPromise(
        campaign.deliveryCutoff,
        campaign.timezone,
        config.locale,
        campaign.design || {},
      );
      if (!shouldRender(campaign, promise)) return;
      entries.push({
        card: buildSurface("block", campaign, promise, config.locale),
        campaign: campaign,
      });
    });

    slot.replaceChildren.apply(
      slot,
      entries.map(function (entry) {
        return entry.card;
      }),
    );

    entries.forEach(function (entry) {
      tick(entry.card, entry.campaign, config, function () {
        renderProductAll(root, campaigns, config);
      });
      emit(entry.campaign);
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
      config.locale,
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

  function buildSurface(variant, campaign, promise, locale) {
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
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: locale,
      variables: promise.vars,
      headline: texts.headline || "Delivery promise",
      body: deliveryMessage(campaign, promise),
      deliveryTime: promise.beforeCutoff
        ? deliveryClock(promise.remainingMs)
        : null,
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
    var key =
      placement === "TOP_BAR"
        ? "customTopBarSelector"
        : placement === "BOTTOM_BAR"
          ? "customBottomBarSelector"
          : "";
    if (!key) return "";

    if (
      settings.separateMobileSelectors &&
      device === "mobile" &&
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
      } catch {
        target = null;
      }
    }

    return null;
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

  function emit(campaign) {
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
