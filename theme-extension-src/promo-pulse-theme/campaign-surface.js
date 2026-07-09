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

  var DEFAULT_DESIGN = {
    templateKey: "clean-minimal",
    layout: "STANDARD",
    backgroundType: "SOLID",
    backgroundColor: "#FFFFFF",
    backgroundImageUrl: "",
    backgroundImageSize: "COVER",
    backgroundImagePosition: "CENTER",
    backgroundImageRepeat: "NO_REPEAT",
    backgroundImageAttachment: "SCROLL",
    gradientStartColor: "#252237",
    gradientEndColor: "#4C4861",
    gradientAngle: 90,
    textColor: "#111827",
    accentColor: "#2563EB",
    buttonColor: "#111827",
    buttonTextColor: "#FFFFFF",
    buttonHoverColor: "#111827",
    buttonTextHoverColor: "#FFFFFF",
    closeButtonColor: "#111827",
    fontSize: 14,
    borderRadius: 4,
    borderSize: 1,
    borderColor: "#E5E7EB",
    fontFamily: "THEME",
    titleFontSize: 22,
    titleColor: "#111827",
    subheadingFontSize: 14,
    subheadingColor: "#4B5563",
    timerFontSize: 38,
    timerColor: "#111827",
    legendFontSize: 12,
    legendColor: "#6B7280",
    timerNumberFontSize: 38,
    timerLabelFontSize: 12,
    timerGap: 10,
    timerUnitGap: 3,
    timerPaddingBlock: 8,
    timerPaddingInline: 12,
    timerStyle: "PLAIN",
    timerFormat: "UNITS",
    timerNumberLayout: "INLINE",
    timerShowLabels: true,
    timerShowSeconds: true,
    timerDaysLabel: "Days",
    timerHoursLabel: "Hrs",
    timerMinutesLabel: "Mins",
    timerSecondsLabel: "Secs",
    timerHideZeroDays: true,
    timerSurfaceColor: "#FFFFFF",
    timerSurfaceBorderColor: "#D1D5DB",
    timerSurfaceBorderSize: 0,
    timerSurfaceRadius: 8,
    paddingBlock: 20,
    paddingInline: 24,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    contentGap: 8,
    contentMaxWidth: 960,
    fullWidth: false,
    positionMode: "FLOW",
    positionSticky: false,
    positionStickyZIndex: 50,
    floatPosition: "FIXED",
    floatOffsetTop: "0",
    floatOffsetBottom: "auto",
    floatOffsetLeft: "0",
    floatOffsetRight: "0",
    entranceAnimation: "FADE",
    exitAnimation: "FADE",
    animationDurationMs: 220,
    timerTickAnimation: "NONE",
    timerTickDurationMs: 220,
    separateMobileDesign: false,
    mobileEnabled: true,
    customCss: "",
    alignment: "CENTER",
    showCloseButton: true,
    closeButtonSize: 20,
    dismissBehavior: "SHOW_AGAIN",
    showButton: true,
    showProgressBar: true,
    progressTarget: "FREE_SHIPPING",
    progressBarStyle: "BAR",
    progressSteps: 4,
    progressHeight: 8,
    progressRadius: 999,
    progressTrackColor: "#E5E7EB",
    progressFillColor: "#22C55E",
    progressTextColor: "#111827",
    progressEffect: "NONE",
    progressShowLabel: false,
    showIcon: false,
    icon: "NONE",
    iconSize: 20,
    customIconUrl: "",
    showDiscountCode: true,
    showCopyCodeButton: true,
    showApplyDiscountButton: true,
    offerCodeLayout: "INLINE",
    offerCodeLabel: "Discount code",
    copyCodeLabel: "Copy code",
    copiedCodeLabel: "Copied",
    applyDiscountLabel: "Apply discount",
    appliedDiscountMessage: "Discount applied successfully.",
    offerCodeTextColor: "#111827",
    offerCodeBackgroundColor: "#FFFFFF",
    offerCodeBorderColor: "#D1D5DB",
    offerCodeFontSize: 13,
    offerCodeBorderRadius: 4,
    offerCodePaddingBlock: 5,
    offerCodePaddingInline: 8,
    offerCodeGap: 6,
    copyButtonBackgroundColor: "#111827",
    copyButtonTextColor: "#FFFFFF",
    copyButtonBorderColor: "#111827",
    copyButtonFontSize: 13,
    copyButtonBorderRadius: 4,
    applyButtonBackgroundColor: "#111827",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#111827",
    applyButtonFontSize: 13,
    applyButtonBorderRadius: 4,
    offerCopyBehavior: "FEEDBACK",
    offerApplyBehavior: "SHOW_APPLIED",
  };

  function normalizeDesign(input) {
    var design = {};
    var raw =
      input && typeof input === "object" && !Array.isArray(input) ? input : {};

    Object.keys(DEFAULT_DESIGN).forEach(function (key) {
      design[key] = DEFAULT_DESIGN[key];
    });
    Object.keys(raw).forEach(function (key) {
      var value = raw[key];
      if (value !== undefined && value !== null) design[key] = value;
    });

    design.structure = normalizeStructure(raw.structure);

    return design;
  }

  function normalizeStructure(input) {
    var packed;
    var output;

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return null;
    }

    packed = decodePackedStructure(input.packed);
    if (!packed) return null;

    output = {};
    Object.keys(input).forEach(function (key) {
      output[key] = input[key];
    });
    output.packed = packed;
    output.css = output.css || "";

    return output;
  }

  function decodePackedStructure(value) {
    // Idempotent: normalizeDesign() can run more than once on the same design
    // (e.g. a payload normalized before render, then again inside build()). On
    // the first pass the packed AST string is parsed into an object and stored
    // back as structure.packed, so later passes receive the already-decoded
    // object. Accept it as-is instead of dropping the whole structure (which
    // silently fell back to the generated layout, losing custom HTML/CSS).
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    if (typeof value !== "string" || !value.trim()) return null;

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  // Mirrors sanitizeBasicHtml() in app/utils/basic-html.ts. Allows only a small
  // set of inline formatting tags, re-emitted from scratch with at most a
  // sanitized class attribute, so message fields can use basic HTML safely.
  var BASIC_HTML_TAGS = {
    b: 1,
    strong: 1,
    i: 1,
    em: 1,
    u: 1,
    s: 1,
    br: 1,
    span: 1,
    small: 1,
    mark: 1,
    sup: 1,
    sub: 1,
  };

  function escapeHtmlText(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function safeClassAttr(rawAttrs) {
    var match = /(?:^|\s)class\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(
      rawAttrs,
    );
    if (!match) return "";
    var rawValue = match[2] || match[3] || match[4] || "";
    var cleaned = rawValue
      .split(/\s+/)
      .map(function (token) {
        return token.replace(/[^a-zA-Z0-9_-]/g, "");
      })
      .filter(Boolean)
      .join(" ");
    return cleaned ? ' class="' + cleaned + '"' : "";
  }

  function sanitizeBasicHtml(input) {
    if (typeof input !== "string" || input.length === 0) return "";
    var out = "";
    var index = 0;
    while (index < input.length) {
      var lt = input.indexOf("<", index);
      if (lt === -1) {
        out += escapeHtmlText(input.slice(index));
        break;
      }
      out += escapeHtmlText(input.slice(index, lt));
      var next = input.charAt(lt + 1);
      if (next !== "/" && !/[a-zA-Z]/.test(next)) {
        out += "&lt;";
        index = lt + 1;
        continue;
      }
      var gt = input.indexOf(">", lt);
      if (gt === -1) {
        out += escapeHtmlText(input.slice(lt));
        break;
      }
      var rawTag = input.slice(lt + 1, gt);
      var parsed = /^(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)\/?\s*$/.exec(rawTag);
      if (parsed) {
        var isClosing = parsed[1] === "/";
        var name = parsed[2].toLowerCase();
        if (BASIC_HTML_TAGS[name]) {
          if (name === "br") {
            if (!isClosing) out += "<br>";
          } else if (isClosing) {
            out += "</" + name + ">";
          } else {
            out += "<" + name + safeClassAttr(parsed[3]) + ">";
          }
        }
      }
      index = gt + 1;
    }
    return out;
  }

  // Sets text that may contain basic HTML, sanitized, on a node.
  function setRichText(node, value) {
    node.innerHTML = sanitizeBasicHtml(value);
  }

  function lower(value) {
    return String(value || "").toLowerCase();
  }

  function dash(value) {
    return lower(value).replace(/_/g, "-");
  }

  function publicSurfaceClasses(variant, placement, design) {
    var dashedPlacement = dash(placement);
    var classes = [];

    if (
      variant === "bar" ||
      placement === "TOP_BAR" ||
      placement === "BOTTOM_BAR" ||
      placement === "CUSTOM_SELECTOR"
    ) {
      classes.push("pp-bar");
      if (dashedPlacement) classes.push("pp-bar--" + dashedPlacement);
      if (design.fullWidth) classes.push("pp-bar--full-width");
      if (design.positionMode === "OVERLAY") classes.push("pp-bar--overlay");
      if (
        (placement === "TOP_BAR" || placement === "BOTTOM_BAR") &&
        design.positionMode !== "OVERLAY" &&
        design.positionSticky
      ) {
        classes.push("pp-bar--sticky");
      }
    }

    if (variant === "block") {
      classes.push("pp-product-card");
      if (dashedPlacement) classes.push("pp-product-card--" + dashedPlacement);
    }

    return classes;
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

    var now = new Date();
    var replacements = {
      time_left: friendlyTimeLeft(spec),
      year: String(now.getFullYear()),
      month: now.toLocaleDateString(spec.locale || undefined, {
        month: "long",
      }),
      day: String(now.getDate()),
      weekday: now.toLocaleDateString(spec.locale || undefined, {
        weekday: "long",
      }),
      date: now.toLocaleDateString(spec.locale || undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: now.toLocaleTimeString(spec.locale || undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
      end_date: formatEndsAt(spec, false),
      end_time: formatEndsAt(spec, true),
    };

    // Individual countdown components when a timer is active.
    if (spec.timer && spec.timer.remainingMs != null) {
      var totalSeconds = Math.max(0, Math.floor(spec.timer.remainingMs / 1000));
      var pad = function (value) {
        return String(value).padStart(2, "0");
      };
      replacements.days_left = String(Math.floor(totalSeconds / 86400));
      replacements.hours_left = pad(Math.floor((totalSeconds % 86400) / 3600));
      replacements.minutes_left = pad(Math.floor((totalSeconds % 3600) / 60));
      replacements.seconds_left = pad(totalSeconds % 60);
    }

    // Campaign-type-specific values (amount, quantity, delivery_*, ...) so any
    // field - headline, body, CTA, badge - can use them, not just the body.
    if (spec.variables && typeof spec.variables === "object") {
      Object.keys(spec.variables).forEach(function (key) {
        var value = spec.variables[key];
        if (value != null && value !== "") replacements[key] = String(value);
      });
    }

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

  function getJustifyItems(alignment) {
    if (alignment === "LEFT") return "start";
    if (alignment === "RIGHT") return "end";
    return "center";
  }

  function getBackgroundImageSizeCssValue(value) {
    if (value === "CONTAIN") return "contain";
    if (value === "AUTO") return "auto";
    if (value === "STRETCH") return "100% 100%";
    return "cover";
  }

  function getBackgroundImagePositionCssValue(value) {
    if (value === "TOP") return "top";
    if (value === "BOTTOM") return "bottom";
    if (value === "LEFT") return "left";
    if (value === "RIGHT") return "right";
    if (value === "TOP_LEFT") return "top left";
    if (value === "TOP_RIGHT") return "top right";
    if (value === "BOTTOM_LEFT") return "bottom left";
    if (value === "BOTTOM_RIGHT") return "bottom right";
    return "center";
  }

  function getBackgroundImageRepeatCssValue(value) {
    if (value === "REPEAT") return "repeat";
    if (value === "REPEAT_X") return "repeat-x";
    if (value === "REPEAT_Y") return "repeat-y";
    return "no-repeat";
  }

  function getBackgroundImageAttachmentCssValue(value) {
    if (value === "FIXED") return "fixed";
    if (value === "LOCAL") return "local";
    return "scroll";
  }

  function getSurfaceBackground(design) {
    if (design.backgroundType === "IMAGE" && design.backgroundImageUrl) {
      return (
        'linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url("' +
        escapeCssUrl(design.backgroundImageUrl) +
        '") ' +
        getBackgroundImagePositionCssValue(design.backgroundImagePosition) +
        " / " +
        getBackgroundImageSizeCssValue(design.backgroundImageSize) +
        " " +
        getBackgroundImageRepeatCssValue(design.backgroundImageRepeat) +
        " " +
        getBackgroundImageAttachmentCssValue(design.backgroundImageAttachment)
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
    design = normalizeDesign(design);

    var vars = {
      "--cp-surface-bg": getSurfaceBackground(design),
      "--cp-bg": design.backgroundColor,
      "--cp-content-max-width": num(design.contentMaxWidth, 960) + "px",
      "--cp-text": design.textColor,
      "--cp-accent": design.accentColor,
      "--cp-button": design.buttonColor,
      "--cp-button-text": design.buttonTextColor,
      "--cp-button-hover": design.buttonHoverColor,
      "--cp-button-text-hover": design.buttonTextHoverColor,
      "--cp-close": design.closeButtonColor,
      "--cp-font-size": num(design.fontSize, 14) + "px",
      "--cp-font-family": FONT_FAMILIES[design.fontFamily] || "inherit",
      "--cp-radius": num(design.borderRadius, 4) + "px",
      "--cp-border-size": num(design.borderSize, 1) + "px",
      "--cp-border-color": design.borderColor,
      "--cp-align": getTextAlign(design.alignment),
      "--cp-justify": getJustifyContent(design.alignment),
      "--cp-justify-items": getJustifyItems(design.alignment),
      "--cp-title-size": num(design.titleFontSize, 22) + "px",
      "--cp-title-color": design.titleColor,
      "--cp-subheading-size": num(design.subheadingFontSize, 14) + "px",
      "--cp-subheading-color": design.subheadingColor,
      // Number/Label size drive all timer sizing (see buildStructureCssVars).
      "--cp-timer-size":
        num(design.timerNumberFontSize, num(design.timerFontSize, 38)) + "px",
      "--cp-timer-color": design.timerColor,
      "--cp-legend-size":
        num(design.timerLabelFontSize, num(design.legendFontSize, 12)) + "px",
      "--cp-legend-color": design.legendColor,
      "--cp-timer-number-size":
        num(design.timerNumberFontSize, num(design.timerFontSize, 38)) + "px",
      "--cp-timer-label-size":
        num(design.timerLabelFontSize, num(design.legendFontSize, 12)) + "px",
      "--cp-timer-gap": num(design.timerGap, 10) + "px",
      "--cp-timer-unit-gap": num(design.timerUnitGap, 3) + "px",
      "--cp-timer-padding-block": num(design.timerPaddingBlock, 8) + "px",
      "--cp-timer-padding-inline": num(design.timerPaddingInline, 12) + "px",
      "--cp-timer-surface": design.timerSurfaceColor,
      "--cp-timer-border": design.timerSurfaceBorderColor,
      "--cp-timer-border-size": num(design.timerSurfaceBorderSize, 0) + "px",
      "--cp-timer-radius": num(design.timerSurfaceRadius, 8) + "px",
      "--cp-padding-block": num(design.paddingBlock, 20) + "px",
      "--cp-padding-inline": num(design.paddingInline, 24) + "px",
      "--cp-margin-top": num(design.marginTop, 0) + "px",
      "--cp-margin-bottom": num(design.marginBottom, 0) + "px",
      "--cp-margin-left": num(design.marginLeft, 0) + "px",
      "--cp-margin-right": num(design.marginRight, 0) + "px",
      "--cp-gap": num(design.contentGap, 8) + "px",
      "--cp-offer-code-text": design.offerCodeTextColor,
      "--cp-offer-code-bg": design.offerCodeBackgroundColor,
      "--cp-offer-code-border": design.offerCodeBorderColor,
      "--cp-offer-code-size": num(design.offerCodeFontSize, 13) + "px",
      "--cp-offer-code-radius": num(design.offerCodeBorderRadius, 4) + "px",
      "--cp-offer-code-padding-block":
        num(design.offerCodePaddingBlock, 5) + "px",
      "--cp-offer-code-padding-inline":
        num(design.offerCodePaddingInline, 8) + "px",
      "--cp-offer-gap": num(design.offerCodeGap, 6) + "px",
      "--cp-offer-copy-bg": design.copyButtonBackgroundColor,
      "--cp-offer-copy-text": design.copyButtonTextColor,
      "--cp-offer-copy-border": design.copyButtonBorderColor,
      "--cp-offer-copy-size": num(design.copyButtonFontSize, 13) + "px",
      "--cp-offer-copy-radius": num(design.copyButtonBorderRadius, 4) + "px",
      "--cp-offer-apply-bg": design.applyButtonBackgroundColor,
      "--cp-offer-apply-text": design.applyButtonTextColor,
      "--cp-offer-apply-border": design.applyButtonBorderColor,
      "--cp-offer-apply-size": num(design.applyButtonFontSize, 13) + "px",
      "--cp-offer-apply-radius": num(design.applyButtonBorderRadius, 4) + "px",
      "--cp-motion-duration": num(design.animationDurationMs, 220) + "ms",
      "--cp-tick-duration": num(design.timerTickDurationMs, 220) + "ms",
      "--cp-float-top": cssLength(design.floatOffsetTop, "0"),
      "--cp-float-bottom": cssLength(design.floatOffsetBottom, "auto"),
      "--cp-float-left": cssLength(design.floatOffsetLeft, "0"),
      "--cp-float-right": cssLength(design.floatOffsetRight, "0"),
      "--cp-sticky-z-index": clampNumber(
        design.positionStickyZIndex,
        0,
        2147483647,
        50,
      ),
    };
    Object.keys(vars).forEach(function (key) {
      if (vars[key] !== undefined && vars[key] !== null) {
        node.style.setProperty(key, String(vars[key]));
      }
    });
  }

  // Mirrors buildTimerParts() in CampaignPreview.tsx.
  function buildTimerParts(remainingMs, design) {
    design = normalizeDesign(design);

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
    design = normalizeDesign(design);

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
        markTimer(colonBoxes, parts, design, compact);
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
      markTimer(colon, parts, design, compact);
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
      markTimer(inline, parts, design, compact);
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
    markTimer(timer, parts, design, compact);
    return timer;
  }

  function markTimer(node, parts, design, compact) {
    node.setAttribute("data-cp-timer", "true");
    publicTimerClasses(design, compact).forEach(function (className) {
      node.classList.add(className);
    });
    setTimerPublicValue(node, parts, design);
  }

  function publicTimerClasses(design, compact) {
    return [
      "pp-countdown",
      "pp-countdown--" + lower(design.timerStyle),
      design.timerFormat === "COLON"
        ? "pp-countdown--colon"
        : "pp-countdown--units",
      design.timerNumberLayout === "STACKED" ? "pp-countdown--stacked" : "",
      compact ? "pp-countdown--compact" : "",
      "pp-countdown--tick-" + lower(design.timerTickAnimation),
    ].filter(Boolean);
  }

  function setTimerPublicValue(node, parts, design) {
    if (!node || !parts || !parts.length) return;
    node.setAttribute("data-value", formatTimerPublicValue(parts, design));
  }

  function formatTimerPublicValue(parts, design) {
    if (design.timerFormat === "COLON") {
      return parts
        .map(function (part) {
          return part.value;
        })
        .join(":");
    }

    return parts
      .map(function (part) {
        return design.timerShowLabels
          ? part.value + " " + part.shortLabel
          : part.value;
      })
      .join(" ");
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
  // Zero-padded value of one countdown part (mirrors timerPartValue in
  // app/utils/campaign-structure.ts).
  function timerPartValue(part, remainingMs) {
    var total = Math.max(0, Math.floor((remainingMs || 0) / 1000));
    if (part === "days") return String(Math.floor(total / 86400));
    if (part === "hours") return pad(Math.floor((total % 86400) / 3600));
    if (part === "minutes") return pad(Math.floor((total % 3600) / 60));
    return pad(total % 60);
  }

  function updateTimer(node, remainingMs, design) {
    if (!node) return;
    design = normalizeDesign(design);

    // Single live countdown part (data-cp-slot="timer-days|hours|minutes|seconds").
    var partName = node.getAttribute("data-cp-timer-part");
    if (partName) {
      var nextPart = timerPartValue(partName, remainingMs);
      if (node.textContent !== nextPart) node.textContent = nextPart;
      return;
    }

    var parts = visibleTimerParts(buildTimerParts(remainingMs, design), design);
    var animate = hasTickAnimation(node);
    setTimerPublicValue(node, parts, design);

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

    var units = node.querySelectorAll(
      ".counterpulse-preview-timer-unit strong",
    );
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
    setTimerPublicValue(node, parts, design);

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
      var nextText = node.classList.contains(
        "counterpulse-preview-timer--colon",
      )
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

    var units = node.querySelectorAll(
      ".counterpulse-preview-timer-unit strong",
    );
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
    if (icon === "STAR") {
      path(
        "M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8L3.5 9.6l5.9-.8L12 3.5Z",
        { fill: "currentColor" },
      );
      return svg;
    }
    if (icon === "BOLT") {
      path("M13 2 4 13.5h6L11 22l9-11.5h-6L13 2Z", { fill: "currentColor" });
      return svg;
    }
    if (icon === "HEART") {
      path(
        "M12 20.3 4.7 13c-2-2-2-5.2 0-7.2a4.9 4.9 0 0 1 7 0l.3.3.3-.3a4.9 4.9 0 0 1 7 0c2 2 2 5.2 0 7.2L12 20.3Z",
        { fill: "currentColor" },
      );
      return svg;
    }
    if (icon === "CART") {
      path("M3 4h2l2.2 11h9.4l2-7H6.5", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-width": "2",
      });
      circle("9", "19", "1.6", { fill: "currentColor" });
      circle("17", "19", "1.6", { fill: "currentColor" });
      return svg;
    }
    if (icon === "PERCENT") {
      path("M6 18 18 6", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-width": "2.2",
      });
      circle("7.5", "7.5", "2.3", { fill: "currentColor" });
      circle("16.5", "16.5", "2.3", { fill: "currentColor" });
      return svg;
    }
    if (icon === "BELL") {
      path("M6.5 17V11a5.5 5.5 0 0 1 11 0v6l1.5 2h-14l1.5-2Z", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linejoin": "round",
        "stroke-width": "2",
      });
      path("M10 20a2 2 0 0 0 4 0", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-width": "2",
      });
      return svg;
    }
    if (icon === "ROCKET") {
      path("M12 3c3.4 1.6 5 4.7 5 8.5L14 15h-4l-3-3.5C7 7.7 8.6 4.6 12 3Z", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linejoin": "round",
        "stroke-width": "2",
      });
      circle("12", "9.5", "1.6", { fill: "currentColor" });
      path("M10 15l-2 4 4-2 4 2-2-4", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linejoin": "round",
        "stroke-width": "2",
      });
      return svg;
    }
    if (icon === "CHECK") {
      circle("12", "12", "8.5", {
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
      });
      path("m8.2 12.2 2.6 2.6 5-5.2", {
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-width": "2.2",
      });
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
    var layout = lower(design.offerCodeLayout);
    var codeWrap = null;
    var copy = null;
    var apply = null;

    if (showCode) {
      codeWrap = el("span", "counterpulse-preview-code-wrap");
      if (design.offerCodeLabel) {
        var label = el("span", "counterpulse-preview-offer-label");
        label.textContent = design.offerCodeLabel;
        codeWrap.appendChild(label);
      }
      var code = el("span", "counterpulse-preview-code");
      code.textContent = offer.code;
      codeWrap.appendChild(code);
    }

    if (showCopy) {
      copy = el("span", "counterpulse-preview-code-action");
      copy.textContent = design.copyCodeLabel;
      copy.setAttribute("role", "button");
      copy.setAttribute("tabindex", "0");
      bindActivate(copy, function () {
        if (typeof handlers.onCopy === "function") handlers.onCopy(copy);
      });
    }

    if (showApply) {
      apply = el(
        "span",
        "counterpulse-preview-cta counterpulse-preview-cta--offer",
      );
      apply.textContent = design.applyDiscountLabel;
      apply.setAttribute("role", "button");
      apply.setAttribute("tabindex", "0");
      bindActivate(apply, function () {
        if (typeof handlers.onApply === "function") handlers.onApply(apply);
      });
    }

    if (layout === "stacked") {
      if (codeWrap) {
        var main = el("span", "counterpulse-preview-offer-main");
        main.appendChild(codeWrap);
        wrap.appendChild(main);
      }
      if (copy || apply) {
        var actions = el("span", "counterpulse-preview-offer-actions");
        if (copy) actions.appendChild(copy);
        if (apply) actions.appendChild(apply);
        wrap.appendChild(actions);
      }
    } else if (layout === "compact") {
      if (codeWrap || copy) {
        var compactCode = el(
          "span",
          "counterpulse-preview-offer-compact-code",
        );
        if (codeWrap) compactCode.appendChild(codeWrap);
        if (copy) compactCode.appendChild(copy);
        wrap.appendChild(compactCode);
      }
      if (apply) wrap.appendChild(apply);
    } else {
      if (codeWrap) wrap.appendChild(codeWrap);
      if (copy) wrap.appendChild(copy);
      if (apply) wrap.appendChild(apply);
    }

    return wrap;
  }

  // Emits the standard click analytics event when the CTA is activated. The
  // consumer passes spec.tracking ({campaignId, experimentId, variantId,
  // placement}); without it the CTA stays untracked (e.g. admin preview).
  function attachCtaTracking(node, spec) {
    var detail = spec && spec.tracking;
    if (!detail || !detail.campaignId) return;
    node.addEventListener("click", function () {
      document.dispatchEvent(
        new CustomEvent("promo-pulse:click", { detail: detail }),
      );
    });
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
    var size = num(design.closeButtonSize, 20);
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
      span.setAttribute("aria-label", "Close promotion");
      span.removeAttribute("aria-hidden");
      bindActivate(span, function () {
        onClose(span);
      });
    }
    return span;
  }

  // Resolves the progress percentage for the configured target. FREE_SHIPPING
  // uses the cart-vs-threshold progress; TIMER uses elapsed time (needs totalMs,
  // i.e. a fixed start+end or an evergreen duration). Returns null when there is
  // no data for the target.
  function progressPercentFor(spec, design) {
    if ((design.progressTarget || "FREE_SHIPPING") === "TIMER") {
      var timer = spec.timer;
      if (!timer || !(timer.totalMs > 0)) return null;
      var elapsed = timer.totalMs - num(timer.remainingMs, 0);
      return Math.min(100, Math.max(0, (elapsed / timer.totalMs) * 100));
    }
    return spec.progress ? num(spec.progress.percentage, 0) : null;
  }

  function applyProgressVars(wrap, design, pct) {
    wrap.style.setProperty("--cp-progress", pct + "%");
    wrap.style.setProperty("--cp-progress-track", design.progressTrackColor);
    wrap.style.setProperty("--cp-progress-fill", design.progressFillColor);
    wrap.style.setProperty("--cp-progress-text", design.progressTextColor);
    wrap.style.setProperty(
      "--cp-progress-height",
      num(design.progressHeight, 8) + "px",
    );
    wrap.style.setProperty(
      "--cp-progress-radius",
      num(design.progressRadius, 999) + "px",
    );
  }

  // Design-driven progress: style (bar/steps/circle), colors, height, radius,
  // effect and optional label, with the percentage resolved from the target.
  function buildProgress(spec, design) {
    if (design.showProgressBar === false) return null;
    var pct = progressPercentFor(spec, design);
    if (pct == null) return null;
    pct = Math.round(pct);

    var style = lower(design.progressBarStyle || "BAR");
    var effect = lower(design.progressEffect || "NONE");
    var unlocked = spec.progress && spec.progress.unlocked;
    var wrap = el(
      "div",
      [
        "counterpulse-preview-progress",
        "counterpulse-preview-progress--" + style,
        "counterpulse-preview-progress--effect-" + effect,
        unlocked ? "counterpulse-preview-progress--unlocked" : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    applyProgressVars(wrap, design, pct);

    if (style === "steps") {
      var steps = clampNumber(design.progressSteps, 2, 12, 4);
      var filled = Math.round((pct / 100) * steps);
      var track = el("span", "counterpulse-preview-progress-steps");
      for (var i = 0; i < steps; i += 1) {
        var step = document.createElement("span");
        if (i < filled) step.className = "is-filled";
        track.appendChild(step);
      }
      wrap.appendChild(track);
    } else if (style === "circle") {
      var circle = el("span", "counterpulse-preview-progress-circle");
      circle.style.setProperty("--cp-progress-deg", (pct / 100) * 360 + "deg");
      var inner = document.createElement("span");
      if (design.progressShowLabel) inner.textContent = pct + "%";
      circle.appendChild(inner);
      wrap.appendChild(circle);
    } else {
      var barTrack = document.createElement("span");
      var fill = document.createElement("span");
      fill.style.width = pct + "%";
      barTrack.appendChild(fill);
      wrap.appendChild(barTrack);
    }

    if (design.progressShowLabel && style !== "circle") {
      var label = el("small", "counterpulse-preview-progress-label");
      label.textContent = pct + "%";
      wrap.appendChild(label);
    }
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
    spec.design = normalizeDesign(spec.design);
    var design = spec.design;
    var variant = spec.variant || "bar";

    // Structure-driven render (saved HTML). Falls through to the standard
    // builder when the campaign has no saved structure or anything goes wrong.
    if (design.structure) {
      var fromStructure = buildFromStructure(spec);
      if (fromStructure) return fromStructure;
    }

    if (variant === "badge") {
      var badge = spec.badge || {};
      var badgeNode = el(
        "div",
        [
          "counterpulse-preview-badge",
          "counterpulse-preview-badge--" + lower(badge.shape || "PILL"),
          "counterpulse-preview-badge--" + dash(badge.position || "TOP_RIGHT"),
          "pp-badge",
          "pp-badge--" + lower(badge.shape || "PILL"),
          "pp-badge--" + dash(badge.position || "TOP_RIGHT"),
          spec.className || "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      applyStyle(badgeNode, design);
      if (spec.dataTestId)
        badgeNode.setAttribute("data-testid", spec.dataTestId);
      var badgeLabel = document.createElement("span");
      badgeLabel.className = "pp-badge-text";
      badgeLabel.textContent = interpolateMessage(
        badge.text || spec.headline || "",
        spec,
      );
      badgeNode.appendChild(badgeLabel);
      if (spec.hasTimer) {
        var badgeTimer = buildTimer(spec, design, true);
        if (badgeTimer) {
          badgeTimer.classList.add("pp-countdown", "pp-countdown--compact");
          badgeNode.appendChild(badgeTimer);
        }
      }
      return badgeNode;
    }

    var isInline = design.layout === "INLINE";
    var section = el(
      "section",
      [
        "counterpulse-preview-promo",
        publicSurfaceClasses(variant, spec.placement, design).join(" "),
        "counterpulse-preview-promo--" + variant,
        "counterpulse-preview-promo--layout-" + lower(design.layout),
        "counterpulse-preview-promo--placement-" + dash(spec.placement),
        design.fullWidth ? "counterpulse-preview-promo--full-width" : "",
        variant === "bar" &&
        (spec.placement === "TOP_BAR" || spec.placement === "BOTTOM_BAR") &&
        design.positionMode !== "OVERLAY" &&
        design.positionSticky
          ? "counterpulse-preview-promo--sticky"
          : "",
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
    // Per-surface scope so merchant custom CSS only affects this campaign.
    var scopeId = uniqueScopeId();
    section.setAttribute("data-cp-uid", scopeId);

    // Message block
    var message = el("div", "counterpulse-preview-message");
    var icon = buildIcon(design);
    if (icon) message.appendChild(icon);
    var copy = el("div", "counterpulse-preview-message-copy");
    var strong = document.createElement("strong");
    setRichText(strong, interpolateMessage(spec.headline || "", spec));
    copy.appendChild(strong);
    if (isInline && spec.hasTimer) {
      var inlineTimer = buildTimer(spec, design, true);
      if (inlineTimer) copy.appendChild(inlineTimer);
    }
    if (!isInline && spec.body) {
      var body = document.createElement("span");
      setRichText(body, interpolateMessage(spec.body, spec));
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
    var offerNode =
      spec.couponNode || buildOffer(design, spec.offer, spec.offerHandlers);
    // The renderer pre-gates CTA visibility (showButton / cart-rescue rules),
    // so the surface simply renders whatever cta text it is handed.
    var hasCta = Boolean(spec.cta);
    if (offerNode || hasCta) {
      var actions = el("div", "counterpulse-preview-actions");
      if (offerNode) actions.appendChild(offerNode);
      if (hasCta) {
        var ctaText = interpolateMessage(spec.cta, spec);
        var cta = el("span", "counterpulse-preview-cta");
        cta.textContent = ctaText;
        if (spec.ctaUrl) {
          var link = document.createElement("a");
          link.className = "counterpulse-preview-cta";
          link.href = spec.ctaUrl;
          link.textContent = ctaText;
          attachCtaTracking(link, spec);
          actions.appendChild(link);
        } else {
          attachCtaTracking(cta, spec);
          actions.appendChild(cta);
        }
      }
      section.appendChild(actions);
    }

    // Close
    var close = buildClose(design, spec.onClose);
    if (close) section.appendChild(close);

    // Progress
    var progress = buildProgress(spec, design);
    if (progress) section.appendChild(progress);

    // Merchant custom CSS (already plan-gated + sanitized on save). Injected as a
    // <style> within the surface; a defensive strip prevents </style> breakout.
    if (typeof design.customCss === "string" && design.customCss.trim()) {
      var styleNode = document.createElement("style");
      styleNode.textContent = scopeCustomCss(
        design.customCss.replace(/<\/?\s*style/gi, ""),
        '[data-cp-uid="' + scopeId + '"]',
      );
      section.appendChild(styleNode);
    }

    return section;
  }

  // -------------------------------------------------------------------------
  // Structure-driven rendering.
  //
  // When a campaign carries saved structural HTML (design.structure), render
  // from that AST instead of the built-in surface builder: rebuild the DOM from
  // the dictionary-packed nodes, scope + inject the per-campaign CSS, then
  // hydrate the `data-cp-slot` placeholders with the same dynamic builders used
  // by the standard builder (timer, offer, progress, icon, close,
  // headline/body/cta). Falls back to null so build() can use the standard path
  // on any problem.
  // -------------------------------------------------------------------------

  var SVG_TAGS = {
    svg: 1,
    path: 1,
    circle: 1,
    line: 1,
    rect: 1,
    polygon: 1,
    polyline: 1,
    ellipse: 1,
    g: 1,
    defs: 1,
    use: 1,
    title: 1,
  };
  var SVG_NS = "http://www.w3.org/2000/svg";

  // Rebuilds the exact DOM from the faithful packed AST. No class/tag rewriting:
  // what the merchant authored is what renders. Element node = [tagId, attrPairs,
  // children]; text node = [tagIdOf("#text"), text].
  function unpackStructureToDom(packed) {
    var tags = packed.t || [];
    var attrNames = packed.a || [];

    function buildNode(arr, svgContext) {
      var tag = tags[arr[0]];
      if (tag === "#text") {
        return document.createTextNode(String(arr[1] == null ? "" : arr[1]));
      }
      var isSvg = svgContext || SVG_TAGS[tag];
      var node = isSvg
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag || "div");
      var attrPairs = arr[1] || [];
      for (var a = 0; a < attrPairs.length; a += 1) {
        var name = attrNames[attrPairs[a][0]];
        var value = attrPairs[a][1];
        if (name) node.setAttribute(name, String(value == null ? "" : value));
      }
      var children = arr[2] || [];
      for (var i = 0; i < children.length; i += 1) {
        node.appendChild(buildNode(children[i], isSvg));
      }
      return node;
    }

    return packed && packed.n ? buildNode(packed.n, false) : null;
  }

  function uniqueScopeId() {
    return "cp" + Math.random().toString(36).slice(2, 9);
  }

  // Mirror of scopeCustomCss() in app/utils/campaign-structure.ts. Prefixes every
  // top-level selector in merchant CSS with `scope` so plain selectors only
  // affect this campaign. Nested at-rules recurse; @keyframes/@font-face/@import
  // and already-scoped selectors are left untouched.
  var CSS_NESTED_AT_RULE = /^@(media|supports|container|layer|scope)\b/i;

  function scopeCustomCss(css, scope) {
    var input = (css == null ? "" : String(css)).trim();
    if (!input) return "";
    return scopeCssRules(input, scope).trim();
  }

  function scopeCssRules(css, scope) {
    var out = "";
    var i = 0;
    var len = css.length;

    while (i < len) {
      var triviaStart = i;
      i = skipCssTrivia(css, i);
      out += css.slice(triviaStart, i);
      if (i >= len) break;

      var j = i;
      var parens = 0;
      while (j < len) {
        var c = css[j];
        if (c === '"' || c === "'") {
          j = skipCssString(css, j);
          continue;
        }
        if (c === "/" && css[j + 1] === "*") {
          j = skipCssComment(css, j);
          continue;
        }
        if (c === "(") parens++;
        else if (c === ")") parens = Math.max(0, parens - 1);
        else if (parens === 0 && (c === "{" || c === ";" || c === "}")) break;
        j++;
      }

      if (j >= len) {
        out += css.slice(i);
        break;
      }

      var delimiter = css[j];
      if (delimiter === ";" || delimiter === "}") {
        out += css.slice(i, j + 1);
        i = j + 1;
        continue;
      }

      var rawPrelude = css.slice(i, j);
      var trimmedPrelude = rawPrelude.trim();
      var blockEnd = matchCssBrace(css, j);
      var block = css.slice(j, blockEnd + 1);

      if (trimmedPrelude.charAt(0) === "@") {
        if (CSS_NESTED_AT_RULE.test(trimmedPrelude)) {
          var inner = css.slice(j + 1, blockEnd);
          out += rawPrelude + "{" + scopeCssRules(inner, scope) + "}";
        } else {
          out += css.slice(i, blockEnd + 1);
        }
      } else {
        var trailingWs = rawPrelude.slice(trimmedPrelude.length);
        out += scopeCssSelectorList(trimmedPrelude, scope) + trailingWs + block;
      }
      i = blockEnd + 1;
    }

    return out;
  }

  function scopeCssSelectorList(selectorList, scope) {
    return splitTopLevelCommas(selectorList)
      .map(function (selector) {
        var trimmed = selector.trim();
        if (!trimmed) return trimmed;
        if (trimmed.indexOf(scope) !== -1 || trimmed.charAt(0) === "&")
          return trimmed;
        return scope + " " + trimmed;
      })
      .join(", ");
  }

  function splitTopLevelCommas(value) {
    var parts = [];
    var depth = 0;
    var start = 0;
    for (var i = 0; i < value.length; i++) {
      var c = value[i];
      if (c === '"' || c === "'") {
        i = skipCssString(value, i) - 1;
        continue;
      }
      if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
      else if (c === "," && depth === 0) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(value.slice(start));
    return parts;
  }

  function skipCssTrivia(css, i) {
    var len = css.length;
    while (i < len) {
      var c = css[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f") {
        i++;
      } else if (c === "/" && css[i + 1] === "*") {
        i = skipCssComment(css, i);
      } else {
        break;
      }
    }
    return i;
  }

  function skipCssComment(css, i) {
    var end = css.indexOf("*/", i + 2);
    return end === -1 ? css.length : end + 2;
  }

  function skipCssString(css, i) {
    var quote = css[i];
    var j = i + 1;
    while (j < css.length) {
      if (css[j] === "\\") {
        j += 2;
        continue;
      }
      if (css[j] === quote) return j + 1;
      j++;
    }
    return css.length;
  }

  function matchCssBrace(css, openIndex) {
    var depth = 0;
    for (var i = openIndex; i < css.length; i++) {
      var c = css[i];
      if (c === '"' || c === "'") {
        i = skipCssString(css, i) - 1;
        continue;
      }
      if (c === "/" && css[i + 1] === "*") {
        i = skipCssComment(css, i) - 1;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return css.length;
  }

  // Replace the slot placeholder with a built node, or remove it when null.
  // Author attributes (class/id/style/data-*) on a slot placeholder are copied
  // onto the built dynamic node so merchants can style/position it. The internal
  // markers (data-cp-slot and the data-cp-* config attrs) are not carried over.
  var SLOT_CONFIG_ATTRS = {
    "data-cp-slot": 1,
    "data-cp-icon": 1,
    "data-cp-icon-size": 1,
    "data-cp-compact": 1,
  };
  function transferSlotAttrs(slotEl, builtNode) {
    if (!slotEl || !builtNode || builtNode.nodeType !== 1) return;
    var attrs = slotEl.attributes;
    for (var i = 0; i < attrs.length; i += 1) {
      var name = attrs[i].name;
      if (SLOT_CONFIG_ATTRS[name]) continue;
      if (name === "class") {
        builtNode.className = (
          builtNode.className +
          " " +
          attrs[i].value
        ).trim();
      } else {
        builtNode.setAttribute(name, attrs[i].value);
      }
    }
  }

  // Adds a class to a node without duplicating it, preserving any classes the
  // merchant already authored on the element.
  function ensureClass(node, className) {
    if (!node || !className) return;
    if (node.classList) {
      node.classList.add(className);
      return;
    }
    var current = node.className || "";
    if ((" " + current + " ").indexOf(" " + className + " ") === -1) {
      node.className = current ? current + " " + className : className;
    }
  }

  function fillReplaceSlot(slotEl, builtNode) {
    if (!slotEl || !slotEl.parentNode) return;
    if (builtNode) {
      transferSlotAttrs(slotEl, builtNode);
      slotEl.parentNode.replaceChild(builtNode, slotEl);
    } else {
      slotEl.parentNode.removeChild(slotEl);
    }
  }

  // Per-instance icon/timer overrides from data-cp-* attributes on the slot.
  function iconDesignFor(slotEl, design) {
    var icon = slotEl.getAttribute("data-cp-icon");
    var size = slotEl.getAttribute("data-cp-icon-size");
    if (!icon && !size) return design;
    var override = Object.assign({}, design);
    if (icon) override.icon = icon;
    if (size) override.iconSize = Number(size) || design.iconSize;
    return override;
  }
  function slotCompact(slotEl, fallback) {
    var value = slotEl.getAttribute("data-cp-compact");
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }

  function fixRootClasses(root, variant, placement, design) {
    // Only normalize the auto-generated default surface. Fully custom merchant
    // HTML is rendered exactly as written.
    if (
      (root.getAttribute("class") || "").indexOf(
        "counterpulse-preview-promo",
      ) === -1
    ) {
      return;
    }
    var keep = [];
    (root.className || "").split(/\s+/).forEach(function (token) {
      if (!token) return;
      if (token === "pp-bar" || token === "pp-product-card") return;
      if (/pp-bar--/.test(token) || /pp-product-card--/.test(token)) return;
      if (/counterpulse-preview-promo--(bar|block|badge)$/.test(token)) return;
      if (/counterpulse-preview-promo--placement-/.test(token)) return;
      if (token === "counterpulse-preview-promo--sticky") return;
      keep.push(token);
    });
    keep = keep.concat(publicSurfaceClasses(variant, placement, design || {}));
    keep.push("counterpulse-preview-promo--" + variant);
    if (placement) {
      keep.push("counterpulse-preview-promo--placement-" + dash(placement));
    }
    if (
      variant === "bar" &&
      (placement === "TOP_BAR" || placement === "BOTTOM_BAR") &&
      design &&
      design.positionMode !== "OVERLAY" &&
      design.positionSticky
    ) {
      keep.push("counterpulse-preview-promo--sticky");
    }
    root.className = keep.join(" ");
  }

  function buildFromStructure(spec) {
    var structure = spec.design && spec.design.structure;
    if (!structure || !structure.packed) return null;
    // Badge variant keeps the standard builder (its structure differs enough that
    // the saved block structure is not a drop-in).
    if (spec.variant === "badge") return null;

    var root;
    try {
      root = unpackStructureToDom(structure.packed);
    } catch (error) {
      return null;
    }
    if (!root) return null;

    var design = spec.design || {};
    fixRootClasses(
      root,
      spec.variant || "bar",
      spec.placement,
      normalizeDesign(spec.design),
    );
    applyStyle(root, design);
    if (spec.className) root.className += " " + spec.className;
    if (spec.dataTestId) root.setAttribute("data-testid", spec.dataTestId);

    hydrateStructureSlots(root, spec, design);
    // Interpolate {{variables}} the merchant typed directly into the structure's
    // own static text (not just the dynamic slots).
    interpolateStructureTextNodes(root, spec);

    // Wrap the surface in a scope element carrying the unique id. The campaign
    // CSS targets __CP_SCOPE__ as an ANCESTOR (e.g. "__CP_SCOPE__ .cp-promo {}"),
    // so the id must live on a wrapper, not on the surface root itself.
    var scopeId = uniqueScopeId();
    var wrapper = document.createElement("div");
    wrapper.setAttribute("data-cp-uid", scopeId);
    wrapper.style.display = "contents";
    wrapper.appendChild(root);

    // Scoped safety baseline (keeps the text column from collapsing next to a
    // fixed-width timer/image) and applies the native surface settings to
    // custom roots. The campaign's own CSS follows and can override it.
    var baseline =
      "__CP_SCOPE__ .cp-promo{box-sizing:border-box;background:var(--cp-surface-bg);color:var(--cp-text);border:var(--cp-border-size) solid var(--cp-border-color);border-radius:var(--cp-radius);font-family:var(--cp-font-family);font-size:var(--cp-font-size);padding:var(--cp-padding-block) var(--cp-padding-inline);margin:var(--cp-margin-top) var(--cp-margin-right) var(--cp-margin-bottom) var(--cp-margin-left)}" +
      "__CP_SCOPE__ .cp-message,__CP_SCOPE__ .cp-message-copy,__CP_SCOPE__ .cp-left{min-width:0}" +
      "__CP_SCOPE__ .cp-message-copy{flex:1 1 auto}" +
      "__CP_SCOPE__ .cp-message-copy strong,__CP_SCOPE__ .cp-message-copy span,__CP_SCOPE__ .cp-message-copy p{overflow-wrap:break-word;word-break:normal}";
    var css =
      baseline +
      "\n" +
      (typeof structure.css === "string" ? structure.css : "");
    var scoped = css
      .replace(/__CP_SCOPE__/g, '[data-cp-uid="' + scopeId + '"]')
      .replace(/<\/?\s*style/gi, "");
    var styleNode = document.createElement("style");
    styleNode.textContent = scoped;
    wrapper.appendChild(styleNode);

    return wrapper;
  }

  // Walks the structure's text nodes and interpolates {{variables}} typed
  // directly into the custom HTML. Idempotent: already-filled slot text has no
  // remaining tokens, so re-running is harmless.
  function interpolateStructureTextNodes(rootEl, spec) {
    if (!rootEl || typeof document.createTreeWalker !== "function") return;
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    var pending = [];
    var current = walker.nextNode();
    while (current) {
      if (current.nodeValue && current.nodeValue.indexOf("{{") !== -1) {
        pending.push(current);
      }
      current = walker.nextNode();
    }
    pending.forEach(function (textNode) {
      textNode.nodeValue = interpolateMessage(textNode.nodeValue, spec);
    });
  }

  // Index custom message snippets shipped with the structure so the
  // data-cp-slot="custom-<id>" slots can be filled (and interpolated) by id.
  function customMessageMap(design) {
    var map = {};
    var messages =
      design && design.structure && design.structure.messages
        ? design.structure.messages
        : [];
    if (!Array.isArray(messages)) return map;
    for (var i = 0; i < messages.length; i += 1) {
      var entry = messages[i];
      if (entry && entry.id) map[entry.id] = entry.text || "";
    }
    return map;
  }

  function hydrateStructureSlots(root, spec, design) {
    var messageMap = customMessageMap(design);
    var slots = root.querySelectorAll("[data-cp-slot]");
    // Snapshot into an array because replace slots mutate the tree.
    var list = [];
    for (var i = 0; i < slots.length; i += 1) list.push(slots[i]);

    list.forEach(function (slotEl) {
      var slot = slotEl.getAttribute("data-cp-slot");
      switch (slot) {
        case "headline":
          setRichText(slotEl, interpolateMessage(spec.headline || "", spec));
          break;
        case "body":
          if (spec.body) {
            setRichText(slotEl, interpolateMessage(spec.body, spec));
          } else {
            fillReplaceSlot(slotEl, null);
          }
          break;
        case "cta": {
          if (!spec.cta) {
            fillReplaceSlot(slotEl, null);
            break;
          }
          // The cta slot is filled in place (not replaced), so unlike the timer/
          // offer/close slots it keeps whatever element the merchant authored. A
          // generated/AI cta placeholder carries no class, so add the shared cta
          // class here — matching the standard builder and the admin preview —
          // so the button keeps its base look (background, color, padding) even
          // when the merchant only overrode a few properties via Custom CSS.
          ensureClass(slotEl, "counterpulse-preview-cta");
          slotEl.textContent = interpolateMessage(spec.cta, spec);
          if (spec.ctaUrl && slotEl.tagName === "A") {
            slotEl.setAttribute("href", spec.ctaUrl);
          }
          attachCtaTracking(slotEl, spec);
          break;
        }
        case "icon":
          fillReplaceSlot(slotEl, buildIcon(iconDesignFor(slotEl, design)));
          break;
        case "timer":
          fillReplaceSlot(
            slotEl,
            spec.hasTimer
              ? buildTimer(spec, design, slotCompact(slotEl, false))
              : null,
          );
          break;
        case "timer-inline":
          fillReplaceSlot(
            slotEl,
            spec.hasTimer
              ? buildTimer(spec, design, slotCompact(slotEl, true))
              : null,
          );
          break;
        case "offer":
          fillReplaceSlot(
            slotEl,
            spec.couponNode ||
              buildOffer(design, spec.offer, spec.offerHandlers),
          );
          break;
        case "close":
          fillReplaceSlot(slotEl, buildClose(design, spec.onClose));
          break;
        case "progress":
          fillReplaceSlot(slotEl, buildProgress(spec, design));
          break;
        case "timer-days":
        case "timer-hours":
        case "timer-minutes":
        case "timer-seconds": {
          // Single live countdown part: fill the number now and tag it so the
          // per-second tick loop keeps it updated.
          var part = slot.slice("timer-".length);
          var ms = spec.timer ? spec.timer.remainingMs : 0;
          slotEl.textContent = timerPartValue(part, ms);
          slotEl.setAttribute("data-cp-timer", "true");
          slotEl.setAttribute("data-cp-timer-part", part);
          break;
        }
        default: {
          // Custom reusable message: data-cp-slot="custom-<id>". Fill with the
          // merchant's snippet, interpolating the campaign's dynamic variables.
          if (slot && slot.indexOf("custom-") === 0) {
            var id = slot.slice("custom-".length);
            if (Object.prototype.hasOwnProperty.call(messageMap, id)) {
              setRichText(slotEl, interpolateMessage(messageMap[id], spec));
            }
          }
          break;
        }
      }
    });
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
    // Total span (for the TIMER progress target): evergreen uses the duration;
    // fixed/recurring use startsAt -> endsAt.
    var totalMs = 0;
    if (mode === "EVERGREEN_SESSION" && timer.durationMinutes) {
      totalMs = Math.round(Number(timer.durationMinutes)) * 60000;
    } else {
      var startsAt = parseDate(campaign.startsAt);
      if (startsAt && endsAt)
        totalMs = Math.max(0, endsAt.getTime() - startsAt.getTime());
    }
    return {
      isActive: Boolean(endsAt && !expired),
      isExpired: expired,
      remainingMs: endsAt ? Math.max(0, endsAt.getTime() - now) : 0,
      totalMs: totalMs,
    };
  }

  window.CountPulseSurface = {
    build: build,
    interpolate: interpolateMessage,
    applyStyle: applyStyle,
    normalizeDesign: normalizeDesign,
    computeTimerState: computeTimerState,
    buildTimer: buildTimer,
    updateTimer: updateTimer,
    updateTimerFromText: updateTimerFromText,
    buildTimerParts: buildTimerParts,
  };
})();
