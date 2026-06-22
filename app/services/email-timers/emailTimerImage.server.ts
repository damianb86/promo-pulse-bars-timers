import { deflateSync } from "node:zlib";

import { EmailTimerExpiredBehavior } from "@prisma/client";

type RenderableEmailTimer = {
  endsAt: Date | string | null;
  expiredBehavior: EmailTimerExpiredBehavior;
  design: unknown;
  campaign: {
    design: {
      backgroundColor: string | null;
      textColor: string | null;
      accentColor: string | null;
    } | null;
  };
};

export type EmailTimerImageResult = {
  body: Buffer;
  width: number;
  height: number;
  expired: boolean;
  remainingSeconds: number;
};

export function renderEmailTimerPng(
  timer: RenderableEmailTimer,
  now = new Date(),
): EmailTimerImageResult {
  const design = readDesign(timer.design);
  const width = clampInteger(design.width, 240, 1200, 600);
  const height = clampInteger(design.height, 80, 400, 180);
  const cornerRadius = clampInteger(design.cornerRadius, 0, 40, 0);
  const borderWidth = clampInteger(design.borderWidth, 0, 16, 0);
  const paddingX = clampInteger(design.paddingX, 0, 160, 34);
  const paddingY = clampInteger(design.paddingY, 0, 120, 24);
  const fontFamily = readFontFamily(design.fontFamily);
  const showHeading = readBoolean(design.showHeading, true);
  const showLabels = readBoolean(design.showLabels, true);
  const headingText = readBitmapText(design.headingText, "ENDS IN", 24);
  const unitVisibility = readUnitVisibility(design);
  const timerLabels = readTimerLabels(design);
  const remainingSeconds = getRemainingSeconds(timer.endsAt, now);
  const expired = remainingSeconds <= 0;

  if (expired && timer.expiredBehavior === EmailTimerExpiredBehavior.HIDE) {
    return {
      body: encodePng(1, 1, new Uint8Array([0, 0, 0, 0])),
      width: 1,
      height: 1,
      expired,
      remainingSeconds,
    };
  }

  const colors = {
    background: readHexColor(
      design.backgroundColor,
      timer.campaign.design?.backgroundColor,
      "#111827",
    ),
    text: readHexColor(
      design.textColor,
      timer.campaign.design?.textColor,
      "#FFFFFF",
    ),
    accent: readHexColor(
      design.accentColor,
      timer.campaign.design?.accentColor,
      "#F97316",
    ),
    label: readHexColor(design.labelColor, design.accentColor, "#FDBA74"),
    border: readHexColor(design.borderColor, design.accentColor, "#111827"),
  };
  const canvas = createCanvas(width, height, colors.background);
  const accentHeight = Math.max(4, Math.floor(height * 0.05));
  const contentX = Math.min(
    Math.floor(width / 2) - 12,
    Math.max(borderWidth + paddingX, 12),
  );
  const contentTop = Math.min(
    Math.floor(height / 2) - 12,
    Math.max(borderWidth + paddingY, accentHeight + 6),
  );
  const contentWidth = Math.max(24, width - contentX * 2);
  const contentHeight = Math.max(
    24,
    height - contentTop - Math.max(borderWidth + paddingY, 12),
  );

  fillRect(canvas, 0, 0, width, accentHeight, colors.accent);

  if (expired) {
    if (timer.expiredBehavior === EmailTimerExpiredBehavior.SHOW_ZERO) {
      drawTimerBlock(canvas, {
        contentHeight,
        contentWidth,
        contentX,
        contentY: contentTop,
        fontFamily,
        headingText,
        labelColor: colors.label,
        showHeading,
        showLabels,
        textColor: colors.text,
        units: buildTimerUnits(0, unitVisibility, timerLabels),
      });
    } else {
      const label = "EXPIRED";
      const scale = fitTextScale(
        label,
        contentWidth,
        contentHeight,
        7,
        "BLOCK",
      );

      drawCenteredTextInBounds(
        canvas,
        label,
        contentX,
        contentWidth,
        contentTop + Math.max(0, Math.floor((contentHeight - scale * 7) / 2)),
        scale,
        colors.text,
        "BLOCK",
      );
    }

    drawBorder(canvas, borderWidth, colors.border);
    applyRoundedCorners(canvas, cornerRadius);

    return {
      body: encodePng(width, height, canvas.pixels),
      width,
      height,
      expired,
      remainingSeconds,
    };
  }

  drawTimerBlock(canvas, {
    contentHeight,
    contentWidth,
    contentX,
    contentY: contentTop,
    fontFamily,
    headingText,
    labelColor: colors.label,
    showHeading,
    showLabels,
    textColor: colors.text,
    units: buildTimerUnits(remainingSeconds, unitVisibility, timerLabels),
  });

  drawBorder(canvas, borderWidth, colors.border);
  applyRoundedCorners(canvas, cornerRadius);

  return {
    body: encodePng(width, height, canvas.pixels),
    width,
    height,
    expired,
    remainingSeconds,
  };
}

function drawTimerBlock(
  canvas: Canvas,
  {
    contentHeight,
    contentWidth,
    contentX,
    contentY,
    fontFamily,
    headingText,
    labelColor,
    showHeading,
    showLabels,
    textColor,
    units,
  }: {
    contentHeight: number;
    contentWidth: number;
    contentX: number;
    contentY: number;
    fontFamily: EmailTimerFontFamily;
    headingText: string;
    labelColor: RgbaColor;
    showHeading: boolean;
    showLabels: boolean;
    textColor: RgbaColor;
    units: TimerUnit[];
  },
) {
  const headingScale = showHeading
    ? Math.min(5, fitTextScale(headingText, contentWidth, 42, 7, "BLOCK"))
    : 0;
  const headingHeight = showHeading ? headingScale * 7 : 0;
  const headingGap = showHeading ? Math.max(5, headingScale * 2) : 0;
  const availableTimerHeight = Math.max(
    16,
    contentHeight - headingHeight - headingGap,
  );
  const timeScale = fitTimerUnitScale(
    units,
    contentWidth,
    availableTimerHeight,
    fontFamily,
    showLabels,
  );
  const labelScale = getTimerLabelScale(timeScale, showLabels);
  const timerHeight = measureTimerUnitsHeight(
    timeScale,
    labelScale,
    showLabels,
  );
  const blockHeight = headingHeight + headingGap + timerHeight;
  const blockTop =
    contentY + Math.max(0, Math.floor((contentHeight - blockHeight) / 2));

  if (showHeading) {
    drawCenteredTextInBounds(
      canvas,
      headingText,
      contentX,
      contentWidth,
      blockTop,
      headingScale,
      textColor,
      "BLOCK",
    );
  }

  drawTimerUnits(canvas, {
    contentWidth,
    contentX,
    fontFamily,
    labelColor,
    labelScale,
    showLabels,
    textColor,
    timeScale,
    units,
    y: blockTop + headingHeight + headingGap,
  });
}

type TimerUnit = {
  key: "days" | "hours" | "minutes" | "seconds";
  label: string;
  value: string;
};

function buildTimerUnits(
  totalSeconds: number,
  visibility: Record<TimerUnit["key"], boolean>,
  labels: Record<TimerUnit["key"], string>,
): TimerUnit[] {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const allUnits: TimerUnit[] = [
    {
      key: "days",
      label: labels.days,
      value: String(days).padStart(2, "0"),
    },
    {
      key: "hours",
      label: labels.hours,
      value: String(hours).padStart(2, "0"),
    },
    {
      key: "minutes",
      label: labels.minutes,
      value: String(minutes).padStart(2, "0"),
    },
    {
      key: "seconds",
      label: labels.seconds,
      value: String(seconds).padStart(2, "0"),
    },
  ];
  const units = allUnits.filter((unit) => visibility[unit.key]);

  return units.length > 0
    ? units
    : [{ key: "seconds", label: labels.seconds, value: "00" }];
}

function drawTimerUnits(
  canvas: Canvas,
  {
    contentWidth,
    contentX,
    fontFamily,
    labelColor,
    labelScale,
    showLabels,
    textColor,
    timeScale,
    units,
    y,
  }: {
    contentWidth: number;
    contentX: number;
    fontFamily: EmailTimerFontFamily;
    labelColor: RgbaColor;
    labelScale: number;
    showLabels: boolean;
    textColor: RgbaColor;
    timeScale: number;
    units: TimerUnit[];
    y: number;
  },
) {
  const gap = getTimerUnitGap(timeScale);
  const columns = units.map((unit) =>
    measureTimerUnitColumn(unit, timeScale, labelScale, fontFamily, showLabels),
  );
  const totalWidth =
    columns.reduce((sum, width) => sum + width, 0) +
    gap * Math.max(0, units.length - 1);
  let cursorX =
    contentX + Math.max(0, Math.floor((contentWidth - totalWidth) / 2));

  units.forEach((unit, index) => {
    const columnWidth = columns[index] ?? 0;
    const timeWidth = measureText(unit.value, timeScale, fontFamily);
    const timeX =
      cursorX + Math.max(0, Math.floor((columnWidth - timeWidth) / 2));

    drawText(canvas, unit.value, timeX, y, timeScale, textColor, fontFamily);

    if (showLabels) {
      const labelWidth = measureText(unit.label, labelScale, "BLOCK");
      const labelX =
        cursorX + Math.max(0, Math.floor((columnWidth - labelWidth) / 2));
      drawText(
        canvas,
        unit.label,
        labelX,
        y + timeScale * 7 + Math.max(4, Math.floor(timeScale * 0.8)),
        labelScale,
        labelColor,
        "BLOCK",
      );
    }

    cursorX += columnWidth + gap;
  });
}

function fitTimerUnitScale(
  units: TimerUnit[],
  maxWidth: number,
  maxHeight: number,
  fontFamily: EmailTimerFontFamily,
  showLabels: boolean,
) {
  for (let scale = 12; scale >= 2; scale -= 1) {
    const labelScale = getTimerLabelScale(scale, showLabels);
    const width = measureTimerUnitsWidth(
      units,
      scale,
      labelScale,
      fontFamily,
      showLabels,
    );
    const height = measureTimerUnitsHeight(scale, labelScale, showLabels);

    if (width <= maxWidth && height <= maxHeight) {
      return scale;
    }
  }

  return 2;
}

function measureTimerUnitsWidth(
  units: TimerUnit[],
  timeScale: number,
  labelScale: number,
  fontFamily: EmailTimerFontFamily,
  showLabels: boolean,
) {
  const gap = getTimerUnitGap(timeScale);

  return (
    units.reduce(
      (sum, unit) =>
        sum +
        measureTimerUnitColumn(
          unit,
          timeScale,
          labelScale,
          fontFamily,
          showLabels,
        ),
      0,
    ) +
    gap * Math.max(0, units.length - 1)
  );
}

function measureTimerUnitColumn(
  unit: TimerUnit,
  timeScale: number,
  labelScale: number,
  fontFamily: EmailTimerFontFamily,
  showLabels: boolean,
) {
  const timeWidth = measureText(unit.value, timeScale, fontFamily);

  if (!showLabels) return timeWidth;

  return Math.max(timeWidth, measureText(unit.label, labelScale, "BLOCK"));
}

function measureTimerUnitsHeight(
  timeScale: number,
  labelScale: number,
  showLabels: boolean,
) {
  return (
    timeScale * 7 +
    (showLabels ? Math.max(4, Math.floor(timeScale * 0.8)) + labelScale * 7 : 0)
  );
}

function getTimerLabelScale(timeScale: number, showLabels: boolean) {
  return showLabels ? Math.max(2, Math.floor(timeScale * 0.34)) : 0;
}

function getTimerUnitGap(timeScale: number) {
  return Math.max(8, Math.floor(timeScale * 2.2));
}

function drawBorder(canvas: Canvas, width: number, color: RgbaColor) {
  if (width <= 0) return;

  fillRect(canvas, 0, 0, canvas.width, width, color);
  fillRect(canvas, 0, canvas.height - width, canvas.width, width, color);
  fillRect(canvas, 0, 0, width, canvas.height, color);
  fillRect(canvas, canvas.width - width, 0, width, canvas.height, color);
}

function drawCenteredTextInBounds(
  canvas: Canvas,
  text: string,
  x: number,
  width: number,
  y: number,
  scale: number,
  color: RgbaColor,
  fontFamily: EmailTimerFontFamily,
) {
  const textWidth = measureText(text, scale, fontFamily);
  const textX = x + Math.max(0, Math.floor((width - textWidth) / 2));

  drawText(canvas, text, textX, y, scale, color, fontFamily);
}

function createCanvas(width: number, height: number, color: RgbaColor) {
  const pixels = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    pixels[offset] = color.r;
    pixels[offset + 1] = color.g;
    pixels[offset + 2] = color.b;
    pixels[offset + 3] = color.a;
  }

  return { width, height, pixels };
}

type Canvas = ReturnType<typeof createCanvas>;

type EmailTimerFontFamily = "BLOCK" | "DIGITAL" | "WIDE" | "COMPACT";

type FontConfig = {
  glyphs: Record<string, string[]>;
  letterSpacing: number;
  pixelWidthRatio: number;
};

function fillRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  color: RgbaColor,
) {
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(canvas.width, x + width);
  const endY = Math.min(canvas.height, y + height);

  for (let row = startY; row < endY; row += 1) {
    for (let column = startX; column < endX; column += 1) {
      setPixel(canvas, column, row, color);
    }
  }
}

function drawText(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: RgbaColor,
  fontFamily: EmailTimerFontFamily,
) {
  let cursorX = x;
  const config = fontConfigs[fontFamily];
  const pixelWidth = Math.max(1, Math.round(scale * config.pixelWidthRatio));

  for (const character of text.toUpperCase()) {
    const glyph = config.glyphs[character] ?? font[character] ?? font[" "];

    for (let row = 0; row < glyph.length; row += 1) {
      const line = glyph[row];

      for (let column = 0; column < line.length; column += 1) {
        if (line[column] === "1") {
          fillRect(
            canvas,
            cursorX + column * scale,
            y + row * scale,
            pixelWidth,
            scale,
            color,
          );
        }
      }
    }

    cursorX += glyph[0].length * scale + config.letterSpacing * scale;
  }
}

function measureText(
  text: string,
  scale: number,
  fontFamily: EmailTimerFontFamily,
) {
  const config = fontConfigs[fontFamily];
  const pixelWidth = Math.max(1, Math.round(scale * config.pixelWidthRatio));

  return text
    .toUpperCase()
    .split("")
    .reduce((width, character, index) => {
      const glyph = config.glyphs[character] ?? font[character] ?? font[" "];
      const glyphWidth = Math.max(
        pixelWidth,
        (glyph[0].length - 1) * scale + pixelWidth,
      );
      return (
        width +
        glyphWidth +
        (index === text.length - 1 ? 0 : config.letterSpacing * scale)
      );
    }, 0);
}

function fitTextScale(
  text: string,
  maxWidth: number,
  maxHeight: number,
  baseHeight: number,
  fontFamily: EmailTimerFontFamily,
) {
  for (let scale = 12; scale >= 2; scale -= 1) {
    if (
      measureText(text, scale, fontFamily) <= maxWidth &&
      baseHeight * scale <= maxHeight
    ) {
      return scale;
    }
  }

  return 2;
}

function setPixel(canvas: Canvas, x: number, y: number, color: RgbaColor) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

  const offset = (y * canvas.width + x) * 4;
  canvas.pixels[offset] = color.r;
  canvas.pixels[offset + 1] = color.g;
  canvas.pixels[offset + 2] = color.b;
  canvas.pixels[offset + 3] = color.a;
}

function applyRoundedCorners(canvas: Canvas, radius: number) {
  const effectiveRadius = Math.min(
    radius,
    Math.floor(canvas.width / 2),
    Math.floor(canvas.height / 2),
  );

  if (effectiveRadius <= 0) return;

  for (let row = 0; row < effectiveRadius; row += 1) {
    for (let column = 0; column < effectiveRadius; column += 1) {
      const dx = effectiveRadius - column - 0.5;
      const dy = effectiveRadius - row - 0.5;

      if (Math.sqrt(dx * dx + dy * dy) <= effectiveRadius) continue;

      setAlpha(canvas, column, row, 0);
      setAlpha(canvas, canvas.width - column - 1, row, 0);
      setAlpha(canvas, column, canvas.height - row - 1, 0);
      setAlpha(canvas, canvas.width - column - 1, canvas.height - row - 1, 0);
    }
  }
}

function setAlpha(canvas: Canvas, x: number, y: number, alpha: number) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

  canvas.pixels[(y * canvas.width + x) * 4 + 3] = alpha;
}

function encodePng(width: number, height: number, rgba: Uint8Array) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);

  for (let row = 0; row < height; row += 1) {
    const scanlineOffset = row * (width * 4 + 1);
    const pixelOffset = row * width * 4;
    scanlines[scanlineOffset] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + pixelOffset, width * 4).copy(
      scanlines,
      scanlineOffset + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", buildIhdr(width, height)),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildIhdr(width: number, height: number) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getRemainingSeconds(value: Date | string | null, now: Date) {
  if (!value) return 0;

  const end = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(end.getTime())) return 0;

  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
}

function readDesign(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;

  return Math.max(min, Math.min(max, parsed));
}

type RgbaColor = { r: number; g: number; b: number; a: number };

function readHexColor(
  primary: unknown,
  secondary: unknown,
  fallback: string,
): RgbaColor {
  const value = [primary, secondary, fallback].find(
    (candidate): candidate is string =>
      typeof candidate === "string" && /^#[0-9a-f]{6}$/i.test(candidate),
  )!;

  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
    a: 255,
  };
}

function readFontFamily(value: unknown): EmailTimerFontFamily {
  if (
    value === "BLOCK" ||
    value === "DIGITAL" ||
    value === "WIDE" ||
    value === "COMPACT"
  ) {
    return value;
  }

  return "BLOCK";
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;

  return fallback;
}

function readUnitVisibility(
  design: Record<string, unknown>,
): Record<TimerUnit["key"], boolean> {
  const visibility = {
    days: readBoolean(design.showDays, true),
    hours: readBoolean(design.showHours, true),
    minutes: readBoolean(design.showMinutes, true),
    seconds: readBoolean(design.showSeconds, true),
  };

  if (
    visibility.days ||
    visibility.hours ||
    visibility.minutes ||
    visibility.seconds
  ) {
    return visibility;
  }

  return { ...visibility, seconds: true };
}

function readTimerLabels(
  design: Record<string, unknown>,
): Record<TimerUnit["key"], string> {
  return {
    days: readBitmapText(design.daysLabel, "Days", 10),
    hours: readBitmapText(design.hoursLabel, "Hrs", 10),
    minutes: readBitmapText(design.minutesLabel, "Mins", 10),
    seconds: readBitmapText(design.secondsLabel, "Secs", 10),
  };
}

function readBitmapText(value: unknown, fallback: string, maxLength: number) {
  const candidate = typeof value === "string" ? value.trim() : "";
  const text = (candidate || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return text.replace(/[^\w\s:.-]/g, "").slice(0, maxLength) || fallback;
}

const digitalFont: Record<string, string[]> = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  ":": ["0", "1", "0", "0", "0", "1", "0"],
  "0": ["111", "101", "101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["111", "001", "001", "111", "100", "100", "111"],
  "3": ["111", "001", "001", "111", "001", "001", "111"],
  "4": ["101", "101", "101", "111", "001", "001", "001"],
  "5": ["111", "100", "100", "111", "001", "001", "111"],
  "6": ["111", "100", "100", "111", "101", "101", "111"],
  "7": ["111", "001", "001", "010", "010", "100", "100"],
  "8": ["111", "101", "101", "111", "101", "101", "111"],
  "9": ["111", "101", "101", "111", "001", "001", "111"],
};

const font: Record<string, string[]> = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  ":": ["0", "1", "1", "0", "1", "1", "0"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

const fontConfigs: Record<EmailTimerFontFamily, FontConfig> = {
  BLOCK: { glyphs: font, letterSpacing: 1, pixelWidthRatio: 1 },
  DIGITAL: { glyphs: digitalFont, letterSpacing: 1, pixelWidthRatio: 1.1 },
  WIDE: { glyphs: font, letterSpacing: 2, pixelWidthRatio: 1.2 },
  COMPACT: { glyphs: font, letterSpacing: 0, pixelWidthRatio: 0.85 },
};
