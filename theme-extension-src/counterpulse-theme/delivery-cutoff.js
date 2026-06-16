(function () {
  "use strict";

  var api = "/apps/counterpulse-campaigns";
  var embed = document.getElementById("counterpulse-app-embed");
  var device = window.matchMedia("(max-width: 767px)").matches
    ? "mobile"
    : "desktop";

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
      debug: root.dataset.debug === "true",
      locale:
        root.dataset.locale ||
        root.dataset.defaultLocale ||
        document.documentElement.lang ||
        "en",
      path: window.location.pathname,
      shop:
        root.dataset.shop ||
        (window.Shopify && window.Shopify.shop) ||
        window.location.hostname,
    };

    if (!config.shop) return;
    ["TOP_BAR", "BOTTOM_BAR"].forEach(function (placement) {
      fetchCampaigns(config, placement).then(function (campaigns) {
        campaigns.forEach(function (campaign) {
          renderGlobal(campaign, config);
        });
      });
    });
  }

  function initProduct(root) {
    var config = {
      campaignId: root.dataset.campaignId || "",
      country: root.dataset.country || "",
      debug: root.dataset.debug === "true",
      fallbackMode: root.dataset.fallbackMode || "AUTO_ELIGIBLE",
      locale: root.dataset.locale || document.documentElement.lang || "en",
      path: window.location.pathname,
      productId: root.dataset.productId || "",
      productTags: split(root.dataset.productTags),
      shop: root.dataset.shop || (window.Shopify && window.Shopify.shop) || "",
    };

    if (!config.shop || !config.productId) return;
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && !config.campaignId)
      return;

    fetchCampaigns(config, "PRODUCT_PAGE").then(function (campaigns) {
      if (campaigns[0]) renderProduct(root, campaigns[0], config);
    });
  }

  function fetchCampaigns(config, placement) {
    var params = new URLSearchParams({
      locale: config.locale,
      path: config.path,
      placement: placement,
      shop: config.shop,
    });

    if (config.country) params.set("country", config.country);
    if (config.productId) params.set("productId", config.productId);
    if (config.productTags && config.productTags.length) {
      params.set("productTags", config.productTags.join(","));
    }
    if (config.fallbackMode === "SPECIFIC_CAMPAIGN" && config.campaignId) {
      params.set("campaignId", config.campaignId);
    }

    return fetch(api + "?" + params.toString(), {
      credentials: "omit",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (payload) {
        applyStorefrontSettings(config, payload.settings);
        return (
          Array.isArray(payload.campaigns) ? payload.campaigns : []
        ).filter(function (campaign) {
          return campaign.type === "DELIVERY_CUTOFF";
        });
      })
      .catch(function (error) {
        if (config.debug && window.console) console.log("[CP delivery]", error);
        return [];
      });
  }

  function renderGlobal(campaign, config) {
    var promise = deliveryPromise(
      campaign.deliveryCutoff,
      campaign.timezone,
      config.locale,
    );
    var existing = document.getElementById(
      "counterpulse-delivery-" + campaign.placement,
    );
    var container;
    var bar;

    if (!shouldRender(campaign, promise)) {
      if (existing) existing.remove();
      return;
    }

    container = getContainer(campaign.placement);
    bar = buildSurface(
      "pp-bar pp-bar--" + campaign.placement.toLowerCase().replace("_", "-"),
      campaign,
      promise,
    );
    bar.id = "counterpulse-delivery-" + campaign.placement;

    if (
      campaign.placement === "TOP_BAR" &&
      (campaign.design || {}).positionSticky
    ) {
      bar.classList.add("pp-bar--sticky");
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
    );
    var card;

    if (!shouldRender(campaign, promise)) {
      root.replaceChildren();
      return;
    }

    card = buildSurface("pp-product-card", campaign, promise);
    root.replaceChildren(card);
    tick(card, campaign, config, function () {
      renderProduct(root, campaign, config);
    });
    emit(campaign);
  }

  function buildSurface(className, campaign, promise) {
    var design = campaign.design || {};
    var surface = document.createElement("section");
    var message = document.createElement("div");
    var headline = document.createElement("strong");
    var detail = document.createElement("span");

    surface.className = className + " pp-delivery-cutoff";
    surface.dataset.campaignId = campaign.id;
    setDesign(surface, design);

    if (design.mobileEnabled === false && device === "mobile")
      surface.hidden = true;

    if (design.showIcon !== false && design.icon !== "NONE") {
      surface.appendChild(node("span", "pp-icon", icon(design.icon)));
    }

    message.className = "pp-message";
    headline.textContent =
      (campaign.texts || {}).headline || "Delivery promise";
    detail.textContent = deliveryMessage(campaign, promise);
    message.appendChild(headline);
    message.appendChild(detail);

    if (promise.beforeCutoff) {
      message.appendChild(renderCountdown(promise.vars.time_left));
    }

    surface.appendChild(message);

    if (campaign.discount && campaign.discount.discountCode) {
      surface.appendChild(
        window.CounterPulseCouponButton(
          campaign.discount.discountCode,
          campaign,
        ),
      );
    }

    if ((campaign.texts || {}).ctaText) {
      surface.appendChild(
        link(
          "pp-cta",
          campaign.texts.ctaText,
          safeUrl(campaign.texts.ctaUrl) ? campaign.texts.ctaUrl : "#",
        ),
      );
    }

    if (design.showCloseButton) surface.appendChild(close(surface));

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

  function deliveryPromise(settings, timezone, locale) {
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
      vars: vars(locale, tz, cutoff, left, ship, min, max),
    };
  }

  function vars(locale, timezone, cutoff, left, ship, min, max) {
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
    var leftText = fmt(left);

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
    if (!surface.querySelector(".pp-countdown")) return;
    var id = window.setInterval(function () {
      if (!surface.isConnected) {
        window.clearInterval(id);
        return;
      }
      var promise = deliveryPromise(
        campaign.deliveryCutoff,
        campaign.timezone,
        config.locale,
      );
      var countdown = surface.querySelector(".pp-countdown");
      if (!promise.beforeCutoff) {
        window.clearInterval(id);
        rerender();
      } else if (countdown) {
        countdown.textContent = promise.vars.time_left;
      }
    }, 1000);
  }

  function getContainer(placement) {
    var id = placement === "BOTTOM_BAR" ? "pp-bottom-bars" : "pp-top-bars";
    var existing = document.getElementById(id);
    var container;
    if (existing) return existing;
    container = document.createElement("div");
    container.id = id;
    container.className =
      "pp-container pp-container--" + placement.toLowerCase().replace("_", "-");
    if (placement === "BOTTOM_BAR") document.body.appendChild(container);
    else document.body.insertBefore(container, document.body.firstChild);
    return container;
  }

  function setDesign(element, design) {
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
    element.style.setProperty("--pp-justify", justify(design.alignment));
    element.style.setProperty("--pp-align", align(design.alignment));
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

  function fmt(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    return pad(h) + ":" + pad(m) + ":" + pad(s);
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

  function renderCountdown(text) {
    var countdown = node("span", "pp-countdown", text);

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
      new CustomEvent("counterpulse:impression", {
        detail: { campaignId: campaign.id, placement: campaign.placement },
      }),
    );
  }

  function icon(value) {
    return (
      { CLOCK: "Time", TRUCK: "Ship", GIFT: "Gift", FIRE: "Sale" }[value] ||
      "Ship"
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

  function applyStorefrontSettings(config, settings) {
    if (!settings || typeof settings !== "object") return;

    window.CounterPulseSettings = settings;
    config.debug = settings.enableDebugMode === true || config.debug;
    config.locale = config.locale || settings.defaultLocale || "";
    config.country = config.country || settings.defaultCountry || "";
  }
})();
