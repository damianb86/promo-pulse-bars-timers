/*
 * Shared campaign surface builder.
 *
 * Produces the EXACT same DOM structure and class names as the in-app preview
 * (app/components/CampaignPreview.tsx -> PromoSurface). Every storefront
 * renderer computes its own data (timer state, free-shipping progress, delivery
 * promise, low-stock copy, offer) and then delegates DOM construction to this
 * module so the live campaign is identical to the preview.
 *
 * Styling lives in campaign-surface.css (ported from the preview + a reset layer
 * so the merchant theme cannot alter how the campaign looks).
 *
 * Exposed as window.CountPulseSurface.
 */
(function () {
  "use strict";

  var FONT_FAMILIES = {
    SYSTEM:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    SERIF: 'Georgia, Cambria, "Times New Roman", Times, serif',
    ROUNDED: '"Nunito", "Quicksand", system-ui, sans-serif',
    MONO: '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
    CONDENSED: '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif',
    CASUAL: '"Trebuchet MS", "Comic Sans MS", system-ui, sans-serif',
  };

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function lower(value) {
    return String(value || "").toLowerCase();
  }

  function dash(value) {
    return lower(value).replace(/_/g, "-");
  }

  function num(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function pad(value) {
    return String(Math.max(0, value)).padStart(2, "0");
  }

  function clampNumber(value, min, max, fallback) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  function escapeCssUrl(value) {
    return String(value || "").replace(/["\\\n\r]/g, "");
  }

  // Friendly remaining-time string for {{time_left}} (e.g. "2d 03h 15m").
  function friendlyTimeLeft(spec) {
    var ms = null;
    if (spec.timer && spec.timer.isActive) {
      ms = spec.timer.remainingMs;
    } else if (spec.deliveryTime) {
      var segs = String(spec.deliveryTime)
        .split(":")
        .map(function (value) {
          return Number(value);
        });
      if (segs.length === 3 && segs.every(Number.isFinite)) {
        ms = ((segs[0] * 60 + segs[1]) * 60 + segs[2]) * 1000;
      }
    }
    if (ms == null) return "";

    var total = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(total / 86400);
    var hours = Math.floor((total % 86400) / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    function pad(value) {
      return String(value).padStart(2, "0");
    }
    if (days > 0) return days + "d " + pad(hours) + "h " + pad(minutes) + "m";
    if (hours > 0) return pad(hours) + "h " + pad(minutes) + "m";
    return pad(minutes) + "m " + pad(seconds) + "s";
  }

  function formatEndsAt(spec, withTime) {
    if (!spec.endsAt) return "";
    var date = new Date(spec.endsAt);
    if (Number.isNaN(date.getTime())) return "";
    var options = withTime
      ? { hour: "numeric", minute: "2-digit" }
      : { day: "numeric", month: "short" };
    if (spec.timezone) options.timeZone = spec.timezone;
    try {
      return new Intl.DateTimeFormat(spec.locale || "en", options).format(date);
    } catch (error) {
      return "";
    }
  }

  // Replaces the global + timer message variables that apply to every campaign
  // type. Type-specific tokens (amount, quantity, delivery_*) are already
  // substituted by each renderer before it hands text to the surface.
  function interpolateMessage(text, spec) {
    if (!text || text.indexOf("{{") === -1) return text || "";

    var replacements = {
      time_left: friendlyTimeLeft(spec),
      time_remaining: friendlyTimeLeft(spec),
      year: String(new Date().getFullYear()),
      end_date: formatEndsAt(spec, false),
      end_time: formatEndsAt(spec, true),
    };

    return text.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      function (match, key) {
        return Object.prototype.hasOwnProperty.call(replacements, key)
          ? replacements[key]
          : match;
      },
    );
  }

  // Normalises a float offset to a CSS length: bare numbers become px, "auto"
  // and existing units pass through, anything else falls back.
  function cssLength(value, fallback) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return fallback;
    if (raw === "auto") return "auto";
    if (/^-?\d+(\.\d+)?$/.test(raw)) return raw + "px";
    if (/^-?\d+(\.\d+)?(px|rem|em|vh|vw|%)$/.test(raw)) return raw;
    return fallback;
  }

  function getTextAlign(alignment) {
    if (alignment === "LEFT") return "left";
    if (alignment === "RIGHT") return "right";
    return "center";
  }

  function getJustifyContent(alignment) {
    if (alignment === "LEFT") return "flex-start";
    if (alignment === "RIGHT") return "flex-end";
    return "center";
  }

  function getSurfaceBackground(design) {
    if (design.backgroundType === "IMAGE" && design.backgroundImageUrl) {
      return (
        "linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url(\"" +
        escapeCssUrl(design.backgroundImageUrl) +
        "\") center / cover no-repeat"
      );
    }
    if (design.backgroundType === "GRADIENT") {
      return (
        "linear-gradient(" +
        num(design.gradientAngle, 90) +
        "deg, " +
        design.gradientStartColor +
        ", " +
        design.gradientEndColor +
        ")"
      );
    }
    return design.backgroundColor;
  }

  // Mirrors buildPreviewStyle() in CampaignPreview.tsx.
  function applyStyle(node, design) {
    var vars = {
      "--cp-surface-bg": getSurfaceBackground(design),
      "--cp-bg": design.backgroundColor,
      "--cp-content-max-width": num(design.contentMaxWidth, 420) + "px",
      "--cp-text": design.textColor,
      "--cp-accent": design.accentColor,
      "--cp-button": design.buttonColor,
      "--cp-button-text": design.buttonTextColor,
      "--cp-close": design.closeButtonColor,
      "--cp-font-size": num(design.fontSize, 15) + "px",
      "--cp-font-family": FONT_FAMILIES[design.fontFamily] || "inherit",
      "--cp-radius": num(design.borderRadius, 0) + "px",
      "--cp-border-size": num(design.borderSize, 0) + "px",
      "--cp-border-color": design.borderColor,
      "--cp-align": getTextAlign(design.alignment),
      "--cp-justify": getJustifyContent(design.alignment),
      "--cp-title-size": num(design.titleFontSize, 18) + "px",
      "--cp-title-color": design.titleColor,
      "--cp-subheading-size": num(design.subheadingFontSize, 14) + "px",
      "--cp-subheading-color": design.subheadingColor,
      "--cp-timer-size": num(design.timerFontSize, 20) + "px",
      "--cp-timer-color": design.timerColor,
      "--cp-legend-size": num(design.legendFontSize, 11) + "px",
      "--cp-legend-color": design.legendColor,
      "--cp-timer-surface": design.timerSurfaceColor,
      "--cp-timer-border": design.timerSurfaceBorderColor,
      "--cp-timer-border-size": num(design.timerSurfaceBorderSize, 0) + "px",
      "--cp-timer-radius": num(design.timerSurfaceRadius, 0) + "px",
      "--cp-padding-block": num(design.paddingBlock, 16) + "px",
      "--cp-padding-inline": num(design.paddingInline, 20) + "px",
      "--cp-margin-top": num(design.marginTop, 0) + "px",
      "--cp-margin-bottom": num(design.marginBottom, 0) + "px",
      "--cp-margin-left": num(design.marginLeft, 0) + "px",
      "--cp-margin-right": num(design.marginRight, 0) + "px",
      "--cp-gap": num(design.contentGap, 12) + "px",
      "--cp-offer-code-text": design.offerCodeTextColor,
      "--cp-offer-code-bg": design.offerCodeBackgroundColor,
      "--cp-offer-code-border": design.offerCodeBorderColor,
      "--cp-offer-code-size": num(design.offerCodeFontSize, 14) + "px",
      "--cp-offer-code-radius": num(design.offerCodeBorderRadius, 0) + "px",
      "--cp-offer-code-padding-block":
        num(design.offerCodePaddingBlock, 6) + "px",
      "--cp-offer-code-padding-inline":
        num(design.offerCodePaddingInline, 10) + "px",
      "--cp-offer-gap": num(design.offerCodeGap, 8) + "px",
      "--cp-motion-duration": num(design.animationDurationMs, 220) + "ms",
      "--cp-float-top": cssLength(design.floatOffsetTop, "0"),
      "--cp-float-bottom": cssLength(design.floatOffsetBottom, "auto"),
      "--cp-float-left": cssLength(design.floatOffsetLeft, "0"),
      "--cp-float-right": cssLength(design.floatOffsetRight, "0"),
    };
    Object.keys(vars).forEach(function (key) {
      if (vars[key] !== undefined && vars[key] !== null) {
        node.style.setProperty(key, String(vars[key]));
      }
    });
  }

  // Mirrors buildTimerParts() in CampaignPreview.tsx.
  function buildTimerParts(remainingMs, design) {
    var totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var includeDays = !design.timerHideZeroDays || days > 0;
    var hours = includeDays
      ? Math.floor((totalSeconds % 86400) / 3600)
      : Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var parts = [];

    if (includeDays) {
      parts.push({
        value: pad(days),
        label: design.timerDaysLabel,
        shortLabel: "Days",
      });
    }
    parts.push({
      value: pad(hours),
      label: design.timerHoursLabel,
      shortLabel: "Hrs",
    });
    parts.push({
      value: pad(minutes),
      label: design.timerMinutesLabel,
      shortLabel: "Mins",
    });
    parts.push({
      value: pad(seconds),
      label: design.timerSecondsLabel,
      shortLabel: "Secs",
    });
    return parts;
  }

  // Mirrors buildTimerPartsFromText() in CampaignPreview.tsx.
  function buildTimerPartsFromText(value) {
    if (!value) return [];
    var segments = String(value)
      .split(":")
      .map(function (segment) {
        return Number(segment.trim());
      })
      .filter(function (segment) {
        return Number.isFinite(segment);
      });
    if (segments.length !== 3) return [];
    return [
      { value: pad(segments[0]), label: "Hrs", shortLabel: "Hrs" },
      { value: pad(segments[1]), label: "Mins", shortLabel: "Mins" },
      { value: pad(segments[2]), label: "Secs", shortLabel: "Secs" },
    ];
  }

  function visibleTimerParts(parts, design) {
    if (design.timerShowSeconds) return parts;
    return parts.filter(function (part) {
      return part.shortLabel !== "Secs";
    });
  }

  // Mirrors TimerDisplay() in CampaignPreview.tsx. Returns a DOM node or null.
  function buildTimer(spec, design, compact) {
    var parts;
    if (spec.timer && spec.timer.isActive) {
      parts = buildTimerParts(spec.timer.remainingMs, design);
    } else {
      parts = buildTimerPartsFromText(spec.deliveryTime);
    }
    parts = visibleTimerParts(parts, design);
    if (!parts.length) return null;

    var classes;

    if (design.timerFormat === "COLON") {
      // Boxes + colon: one box per number with the ":" separators between the
      // boxes (outside them).
      if (design.timerStyle === "BOXES") {
        var colonBoxes = el(
          "div",
          [
            "counterpulse-preview-timer",
            "counterpulse-preview-timer--colon",
            "counterpulse-preview-timer--boxes",
            "counterpulse-preview-timer--colon-boxes",
            "counterpulse-preview-timer--tick-" +
              lower(design.timerTickAnimation),
            compact ? "counterpulse-preview-timer--compact" : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
        parts.forEach(function (part, index) {
          if (index > 0) {
            var sep = el("span", "counterpulse-preview-timer-sep");
            sep.setAttribute("aria-hidden", "true");
            sep.textContent = ":";
            colonBoxes.appendChild(sep);
          }
          var unit = el("span", "counterpulse-preview-timer-unit");
          var strong = document.createElement("strong");
          strong.textContent = part.value;
          unit.appendChild(strong);
          colonBoxes.appendChild(unit);
        });
        markTimer(colonBoxes);
        return colonBoxes;
      }

      classes = [
        "counterpulse-preview-timer",
        "counterpulse-preview-timer--colon",
        "counterpulse-preview-timer--" + lower(design.timerStyle),
        "counterpulse-preview-timer--tick-" + lower(design.timerTickAnimation),
        compact ? "counterpulse-preview-timer--compact" : "",
      ];
      var colon = el("div", classes.filter(Boolean).join(" "));
      colon.textContent = parts
        .map(function (part) {
          return part.value;
        })
        .join(":");
      markTimer(colon);
      return colon;
    }

    if (compact && design.timerStyle === "PLAIN") {
      classes = [
        "counterpulse-preview-timer",
        "counterpulse-preview-timer--inline-plain",
        "counterpulse-preview-timer--tick-" + lower(design.timerTickAnimation),
      ];
      var inline = el("span", classes.filter(Boolean).join(" "));
      inline.textContent = parts
        .map(function (part) {
          return design.timerShowLabels
            ? part.value + " " + part.shortLabel
            : part.value;
        })
        .join(" ");
      markTimer(inline);
      return inline;
    }

    classes = [
      "counterpulse-preview-timer",
      "counterpulse-preview-timer--" + lower(design.timerStyle),
      design.timerNumberLayout === "STACKED"
        ? "counterpulse-preview-timer--stacked"
        : "",
      "counterpulse-preview-timer--tick-" + lower(design.timerTickAnimation),
      compact ? "counterpulse-preview-timer--compact" : "",
    ];
    var timer = el("div", classes.filter(Boolean).join(" "));
    parts.forEach(function (part) {
      var unit = el("span", "counterpulse-preview-timer-unit");
      var strong = document.createElement("strong");
      strong.textContent = part.value;
      unit.appendChild(strong);
      if (design.timerShowLabels) {
        var small = document.createElement("small");
        small.textContent = part.label;
        unit.appendChild(small);
      }
      timer.appendChild(unit);
    });
    markTimer(timer);
    return timer;
  }

  function markTimer(node) {
    node.setAttribute("data-cp-timer", "true");
  }

  // The tick animations (fade/flip/pulse) are CSS animations that run on mount.
  // In the preview they replay because React remounts the element (keyed by
  // value). On the storefront we update text in place, so we must restart the
  // animation manually to make the effect visible on every tick.
  function hasTickAnimation(node) {
    return /counterpulse-preview-timer--tick-(fade|flip|pulse)/.test(
      node.className || "",
    );
  }

  function replayAnimation(el) {
    if (!el) return;
    el.style.animation = "none";
    // Force a reflow so the browser registers the reset before re-enabling.
    void el.offsetWidth;
    el.style.animation = "";
  }

  // Live update of an existing timer node built by buildTimer.
  function updateTimer(node, remainingMs, design) {
    if (!node) return;
    var parts = visibleTimerParts(buildTimerParts(remainingMs, design), design);
    var animate = hasTickAnimation(node);

    // Per-box timers (units present, e.g. boxes + colon) update each box.
    if (node.querySelector(".counterpulse-preview-timer-unit strong")) {
      var boxUnits = node.querySelectorAll(
        ".counterpulse-preview-timer-unit strong",
      );
      for (var u = 0; u < boxUnits.length && u < parts.length; u += 1) {
        if (boxUnits[u].textContent !== parts[u].value) {
          boxUnits[u].textContent = parts[u].value;
          if (animate) replayAnimation(boxUnits[u]);
        }
      }
      return;
    }

    if (
      node.classList.contains("counterpulse-preview-timer--colon") ||
      node.classList.contains("counterpulse-preview-timer--inline-plain")
    ) {
      var nextText;
      if (node.classList.contains("counterpulse-preview-timer--colon")) {
        nextText = parts
          .map(function (part) {
            return part.value;
          })
          .join(":");
      } else {
        nextText = parts
          .map(function (part) {
            return design.timerShowLabels
              ? part.value + " " + part.shortLabel
              : part.value;
          })
          .join(" ");
      }
      if (node.textContent !== nextText) {
        node.textContent = nextText;
        if (animate) replayAnimation(node);
      }
      return;
    }

    var units = node.querySelectorAll(".counterpulse-preview-timer-unit strong");
    for (var i = 0; i < units.length && i < parts.length; i += 1) {
      if (units[i].textContent !== parts[i].value) {
        units[i].textContent = parts[i].value;
        if (animate) replayAnimation(units[i]);
      }
    }
  }

  // Live update of a timer node that was built from a "HH:MM:SS" text value
  // (used by the delivery-cutoff countdown).
  function updateTimerFromText(node, text, design) {
    if (!node) return;
    var parts = visibleTimerParts(buildTimerPartsFromText(text), design);
    if (!parts.length) return;
    var animate = hasTickAnimation(node);

    // Per-box timers (units present, e.g. boxes + colon) update each box.
    if (node.querySelector(".counterpulse-preview-timer-unit strong")) {
      var boxUnits = node.querySelectorAll(
        ".counterpulse-preview-timer-unit strong",
      );
      for (var u = 0; u < boxUnits.length && u < parts.length; u += 1) {
        if (boxUnits[u].textContent !== parts[u].value) {
          boxUnits[u].textContent = parts[u].value;
          if (animate) replayAnimation(boxUnits[u]);
        }
      }
      return;
    }

    if (
      node.classList.contains("counterpulse-preview-timer--colon") ||
      node.classList.contains("counterpulse-preview-timer--inline-plain")
    ) {
      var nextText = node.classList.contains("counterpulse-preview-timer--colon")
        ? parts
            .map(function (part) {
              return part.value;
            })
            .join(":")
        : parts
            .map(function (part) {
              return design.timerShowLabels
                ? part.value + " " + part.shortLabel
                : part.value;
            })
            .join(" ");
      if (node.textContent !== nextText) {
        node.textContent = nextText;
        if (animate) replayAnimation(node);
      }
      return;
    }

    var units = node.querySelectorAll(".counterpulse-preview-timer-unit strong");
    for (var i = 0; i < units.length && i < parts.length; i += 1) {
      if (units[i].textContent !== parts[i].value) {
        units[i].textContent = parts[i].value;
        if (animate) replayAnimation(units[i]);
      }
    }
  }

  function iconSvg(icon) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("focusable", "false");

    function path(d, attrs) {
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      Object.keys(attrs || {}).forEach(function (key) {
        p.setAttribute(key, attrs[key]);
      });
      svg.appendChild(p);
    }
    function circle(cx, cy, r, attrs) {
      var c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", cx);
      c.setAttribute("cy", cy);
      c.setAttribute("r", r);
      Object.keys(attrs || {}).forEach(function (key) {
        c.setAttribute(key, attrs[key]);
      });
      svg.appendChild(c);
    }

    if (icon === "FIRE") {
      path(
        "M12.5 21c-4.1 0-7-2.7-7-6.6 0-2.6 1.4-4.8 3.6-6.9.2 1.7 1 3 2.1 3.8 1.8-2.7 1.4-5.6.3-8.3 4.5 2.2 7 5.9 7 10.5 0 4.4-2.5 7.5-6 7.5Z",
        { fill: "currentColor" },
      );
      path(
        "M12.2 18.8c-1.7 0-2.9-1.1-2.9-2.7 0-1.2.7-2.2 1.8-3.1.1 1 .6 1.7 1.3 2.1.8-1.1.8-2.4.4-3.6 1.7 1.1 2.7 2.6 2.7 4.3 0 1.8-1.4 3-3.3 3Z",
        { fill: "rgba(255,255,255,.55)" },
      );
      return svg;
    }
    if (icon === "CLOCK") {
      circle("12", "12", "8", {
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2.2",
      });
      path("M12 7.5v5l3.4 2", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-width": "2.2",
      });
      return svg;
    }
    if (icon === "TRUCK") {
      path("M3.5 7h10v8h-10zM13.5 10h3.4l2.6 2.6V15h-6z", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linejoin": "round",
        "stroke-width": "2",
      });
      circle("7", "17", "1.8", { fill: "currentColor" });
      circle("17", "17", "1.8", { fill: "currentColor" });
      return svg;
    }
    if (icon === "GIFT") {
      path("M4.5 10h15v10h-15zM3.5 7h17v3h-17zM12 7v13", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linejoin": "round",
        "stroke-width": "2",
      });
      path(
        "M12 7c-2.4 0-4-1-4-2.4C8 3.7 8.7 3 9.6 3c1.2 0 2 1.4 2.4 4Zm0 0c2.4 0 4-1 4-2.4 0-.9-.7-1.6-1.6-1.6-1.2 0-2 1.4-2.4 4Z",
        {
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
        },
      );
      return svg;
    }
    if (icon === "TAG") {
      path("M4 12.2 12.2 4H20v7.8L11.8 20 4 12.2Z", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linejoin": "round",
        "stroke-width": "2",
      });
      circle("16.8", "7.2", "1.3", { fill: "currentColor" });
      return svg;
    }
    return null;
  }

  // Mirrors PreviewIcon() in CampaignPreview.tsx. Returns a node or null.
  function buildIcon(design) {
    if (design.icon === "NONE") return null;
    var span = el("span", "counterpulse-preview-icon");
    span.setAttribute("aria-hidden", "true");
    span.style.setProperty(
      "--cp-icon-size",
      clampNumber(design.iconSize, 12, 64, 20) + "px",
    );

    if (design.icon === "CUSTOM" && design.customIconUrl) {
      var img = document.createElement("img");
      img.alt = "";
      img.src = design.customIconUrl;
      span.appendChild(img);
      return span;
    }
    var svg = iconSvg(design.icon);
    if (!svg) return null;
    span.appendChild(svg);
    return span;
  }

  // Mirrors OfferPreview() in CampaignPreview.tsx, but the action labels are
  // wired to the supplied handlers so copy/apply stay functional.
  function buildOffer(design, offer, handlers) {
    if (!offer) return null;
    var showCode = design.showDiscountCode;
    var showCopy = design.showCopyCodeButton;
    var showApply = design.showApplyDiscountButton && offer.canApply;
    if (!showCode && !showCopy && !showApply) return null;

    handlers = handlers || {};
    var wrap = el(
      "span",
      "counterpulse-preview-offer counterpulse-preview-offer--" +
        lower(design.offerCodeLayout),
    );

    if (showCode) {
      var codeWrap = el("span", "counterpulse-preview-code-wrap");
      if (design.offerCodeLabel) {
        var label = el("span", "counterpulse-preview-offer-label");
        label.textContent = design.offerCodeLabel;
        codeWrap.appendChild(label);
      }
      var code = el("span", "counterpulse-preview-code");
      code.textContent = offer.code;
      codeWrap.appendChild(code);
      wrap.appendChild(codeWrap);
    }

    if (showCopy) {
      var copy = el("span", "counterpulse-preview-code-action");
      copy.textContent = design.copyCodeLabel;
      copy.setAttribute("role", "button");
      copy.setAttribute("tabindex", "0");
      bindActivate(copy, function () {
        if (typeof handlers.onCopy === "function") handlers.onCopy(copy);
      });
      wrap.appendChild(copy);
    }

    if (showApply) {
      var apply = el(
        "span",
        "counterpulse-preview-cta counterpulse-preview-cta--offer",
      );
      apply.textContent = design.applyDiscountLabel;
      apply.setAttribute("role", "button");
      apply.setAttribute("tabindex", "0");
      bindActivate(apply, function () {
        if (typeof handlers.onApply === "function") handlers.onApply(apply);
      });
      wrap.appendChild(apply);
    }

    return wrap;
  }

  function bindActivate(node, handler) {
    node.addEventListener("click", function (event) {
      event.preventDefault();
      handler();
    });
    node.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handler();
    });
  }

  function buildClose(design, onClose) {
    if (!design.showCloseButton) return null;
    var size = num(design.closeButtonSize, 18);
    var span = el("span", "counterpulse-preview-close");
    span.setAttribute("aria-hidden", "true");
    span.style.width = size + "px";
    span.style.height = size + "px";

    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    [
      ["6", "6", "18", "18"],
      ["18", "6", "6", "18"],
    ].forEach(function (coords) {
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", coords[0]);
      line.setAttribute("y1", coords[1]);
      line.setAttribute("x2", coords[2]);
      line.setAttribute("y2", coords[3]);
      svg.appendChild(line);
    });
    span.appendChild(svg);

    if (typeof onClose === "function") {
      span.setAttribute("role", "button");
      span.setAttribute("tabindex", "0");
      span.removeAttribute("aria-hidden");
      bindActivate(span, function () {
        onClose(span);
      });
    }
    return span;
  }

  function buildProgress(progress, design) {
    if (!progress || design.showProgressBar === false) return null;
    var classes = [
      "counterpulse-preview-progress",
      "counterpulse-preview-progress--" + lower(progress.style || "BAR"),
      progress.unlocked ? "counterpulse-preview-progress--unlocked" : "",
    ];
    var wrap = el("div", classes.filter(Boolean).join(" "));
    wrap.style.setProperty("--cp-progress", num(progress.percentage, 0) + "%");
    var track = document.createElement("span");
    var fill = document.createElement("span");
    fill.style.width = num(progress.percentage, 0) + "%";
    track.appendChild(fill);
    wrap.appendChild(track);
    return wrap;
  }

  /*
   * build(spec) -> DOM element matching PromoSurface.
   *
   * spec = {
   *   variant: "bar" | "block" | "badge",
   *   placement: "PRODUCT_PAGE" | ...,
   *   design: <raw campaign.design>,
   *   headline: string,
   *   body: string | null,
   *   timer: { isActive, isExpired, remainingMs } | null,
   *   deliveryTime: "HH:MM:SS" | null,
   *   hasTimer: boolean,
   *   offer: { code, canApply } | null,
   *   offerHandlers: { onCopy, onApply } | null,
   *   couponNode: HTMLElement | null,   // functional widget placed in actions
   *   cta: string | null,
   *   progress: { percentage, style, unlocked } | null,
   *   badge: { text, shape, position } | null,  // badge variant only
   *   className: string,
   *   dataTestId: string,
   *   onClose: function | null,
   * }
   */
  function build(spec) {
    spec = spec || {};
    var design = spec.design || {};
    var variant = spec.variant || "bar";

    if (variant === "badge") {
      var badge = spec.badge || {};
      var badgeNode = el(
        "div",
        [
          "counterpulse-preview-badge",
          "counterpulse-preview-badge--" + lower(badge.shape || "PILL"),
          "counterpulse-preview-badge--" + dash(badge.position || "TOP_RIGHT"),
          spec.className || "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      applyStyle(badgeNode, design);
      if (spec.dataTestId) badgeNode.setAttribute("data-testid", spec.dataTestId);
      var badgeLabel = document.createElement("span");
      badgeLabel.textContent = interpolateMessage(
        badge.text || spec.headline || "",
        spec,
      );
      badgeNode.appendChild(badgeLabel);
      if (spec.hasTimer) {
        var badgeTimer = buildTimer(spec, design, true);
        if (badgeTimer) badgeNode.appendChild(badgeTimer);
      }
      return badgeNode;
    }

    var isInline = design.layout === "INLINE";
    var section = el(
      "section",
      [
        "counterpulse-preview-promo",
        "counterpulse-preview-promo--" + variant,
        "counterpulse-preview-promo--layout-" + lower(design.layout),
        "counterpulse-preview-promo--placement-" + dash(spec.placement),
        design.fullWidth ? "counterpulse-preview-promo--full-width" : "",
        "counterpulse-preview-promo--position-" + lower(design.positionMode),
        design.positionMode === "OVERLAY"
          ? "counterpulse-preview-promo--float-" +
            lower(design.floatPosition || "FIXED")
          : "",
        "counterpulse-preview-promo--enter-" + lower(design.entranceAnimation),
        "counterpulse-preview-promo--exit-" + lower(design.exitAnimation),
        spec.className || "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    applyStyle(section, design);
    if (spec.dataTestId) section.setAttribute("data-testid", spec.dataTestId);

    // Message block
    var message = el("div", "counterpulse-preview-message");
    var icon = buildIcon(design);
    if (icon) message.appendChild(icon);
    var copy = el("div", "counterpulse-preview-message-copy");
    var strong = document.createElement("strong");
    strong.textContent = interpolateMessage(spec.headline || "", spec);
    copy.appendChild(strong);
    if (isInline && spec.hasTimer) {
      var inlineTimer = buildTimer(spec, design, true);
      if (inlineTimer) copy.appendChild(inlineTimer);
    }
    if (!isInline && spec.body) {
      var body = document.createElement("span");
      body.textContent = interpolateMessage(spec.body, spec);
      copy.appendChild(body);
    }
    message.appendChild(copy);
    section.appendChild(message);

    // Block-level timer
    if (!isInline && spec.hasTimer) {
      var blockTimer = buildTimer(spec, design, false);
      if (blockTimer) section.appendChild(blockTimer);
    }

    // Actions (offer + cta)
    var offerNode = spec.couponNode || buildOffer(design, spec.offer, spec.offerHandlers);
    // The renderer pre-gates CTA visibility (showButton / cart-rescue rules),
    // so the surface simply renders whatever cta text it is handed.
    var hasCta = Boolean(spec.cta);
    if (offerNode || hasCta) {
      var actions = el("div", "counterpulse-preview-actions");
      if (offerNode) actions.appendChild(offerNode);
      if (hasCta) {
        var cta = el("span", "counterpulse-preview-cta");
        cta.textContent = spec.cta;
        if (spec.ctaUrl) {
          var link = document.createElement("a");
          link.className = "counterpulse-preview-cta";
          link.href = spec.ctaUrl;
          link.textContent = spec.cta;
          actions.appendChild(link);
        } else {
          actions.appendChild(cta);
        }
      }
      section.appendChild(actions);
    }

    // Close
    var close = buildClose(design, spec.onClose);
    if (close) section.appendChild(close);

    // Progress
    var progress = buildProgress(spec.progress, design);
    if (progress) section.appendChild(progress);

    return section;
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function safeStorage(name) {
    try {
      return window[name] || null;
    } catch (error) {
      return null;
    }
  }

  function evergreenDeadline(id, timer) {
    var storage = safeStorage(
      timer.resetBehavior === "ON_SESSION_END"
        ? "sessionStorage"
        : "localStorage",
    );
    var key = "promo_pulse_surface_deadline_" + id;
    var stored = storage ? parseDate(storage.getItem(key)) : null;
    var duration = Number(timer.durationMinutes);
    var endsAt;

    if (stored) {
      if (stored.getTime() > Date.now()) return stored;
      if (timer.expiredBehavior !== "REPEAT_COUNTDOWN") return stored;
    }

    endsAt = new Date(Date.now() + Math.round(duration) * 60000);
    try {
      if (storage) storage.setItem(key, endsAt.toISOString());
    } catch (error) {
      /* storage blocked */
    }
    return endsAt;
  }

  // Canonical timer-state computation available to every block (the app embed's
  // PromoPulseComputeTimerState is only present when the embed is on the page).
  // FIXED_DATE and EVERGREEN_SESSION are resolved locally; the timezone-aware
  // recurring modes reuse the embed implementation when available.
  function computeTimerState(campaign) {
    campaign = campaign || {};
    var timer = campaign.timer || {};
    var mode = timer.mode || "FIXED_DATE";
    var now = Date.now();
    var endsAt = null;

    if (mode === "EVERGREEN_SESSION" && timer.durationMinutes) {
      endsAt = evergreenDeadline(campaign.id, timer);
    } else if (mode === "RECURRING_DAILY" || mode === "RECURRING_WEEKLY") {
      if (typeof window.PromoPulseComputeTimerState === "function") {
        return window.PromoPulseComputeTimerState(campaign);
      }
      endsAt = parseDate(campaign.endsAt);
    } else {
      endsAt = parseDate(campaign.endsAt);
    }

    var expired = endsAt ? endsAt.getTime() <= now : false;
    return {
      isActive: Boolean(endsAt && !expired),
      isExpired: expired,
      remainingMs: endsAt ? Math.max(0, endsAt.getTime() - now) : 0,
    };
  }

  window.CountPulseSurface = {
    build: build,
    applyStyle: applyStyle,
    computeTimerState: computeTimerState,
    buildTimer: buildTimer,
    updateTimer: updateTimer,
    updateTimerFromText: updateTimerFromText,
    buildTimerParts: buildTimerParts,
  };
})();
