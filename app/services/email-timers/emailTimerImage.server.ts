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
  };
  const canvas = createCanvas(width, height, colors.background);
  const accentHeight = Math.max(4, Math.floor(height * 0.05));

  fillRect(canvas, 0, 0, width, accentHeight, colors.accent);

  if (expired) {
    const label =
      timer.expiredBehavior === EmailTimerExpiredBehavior.SHOW_ZERO
        ? "00:00:00"
        : "EXPIRED";
    const scale = fitTextScale(label, width - 40, Math.floor(height * 0.34), 7);

    drawCenteredText(
      canvas,
      label,
      Math.floor(height * 0.38),
      scale,
      colors.text,
    );
    if (timer.expiredBehavior === EmailTimerExpiredBehavior.SHOW_ZERO) {
      drawCenteredText(
        canvas,
        "HRS MIN SEC",
        Math.floor(height * 0.7),
        Math.max(2, Math.floor(scale * 0.36)),
        colors.accent,
      );
    }

    return {
      body: encodePng(width, height, canvas.pixels),
      width,
      height,
      expired,
      remainingSeconds,
    };
  }

  const timeText = formatRemainingTime(remainingSeconds);
  const labelText = timeText.length > 8 ? "DAYS HRS MIN SEC" : "HRS MIN SEC";
  const timeScale = fitTextScale(
    timeText,
    width - 40,
    Math.floor(height * 0.38),
    7,
  );
  const labelScale = Math.max(2, Math.floor(timeScale * 0.34));
  const headingScale = Math.max(2, Math.min(4, Math.floor(timeScale * 0.45)));

  drawCenteredText(
    canvas,
    "ENDS IN",
    Math.floor(height * 0.18),
    headingScale,
    colors.accent,
  );
  drawCenteredText(
    canvas,
    timeText,
    Math.floor(height * 0.39),
    timeScale,
    colors.text,
  );
  drawCenteredText(
    canvas,
    labelText,
    Math.floor(height * 0.74),
    labelScale,
    colors.accent,
  );

  return {
    body: encodePng(width, height, canvas.pixels),
    width,
    height,
    expired,
    remainingSeconds,
  };
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

function drawCenteredText(
  canvas: Canvas,
  text: string,
  y: number,
  scale: number,
  color: RgbaColor,
) {
  const width = measureText(text, scale);
  const x = Math.max(0, Math.floor((canvas.width - width) / 2));

  drawText(canvas, text, x, y, scale, color);
}

function drawText(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: RgbaColor,
) {
  let cursorX = x;

  for (const character of text.toUpperCase()) {
    const glyph = font[character] ?? font[" "];

    for (let row = 0; row < glyph.length; row += 1) {
      const line = glyph[row];

      for (let column = 0; column < line.length; column += 1) {
        if (line[column] === "1") {
          fillRect(
            canvas,
            cursorX + column * scale,
            y + row * scale,
            scale,
            scale,
            color,
          );
        }
      }
    }

    cursorX += (glyph[0].length + 1) * scale;
  }
}

function measureText(text: string, scale: number) {
  return text
    .toUpperCase()
    .split("")
    .reduce((width, character, index) => {
      const glyph = font[character] ?? font[" "];
      const glyphWidth = glyph[0].length * scale;
      return width + glyphWidth + (index === text.length - 1 ? 0 : scale);
    }, 0);
}

function fitTextScale(
  text: string,
  maxWidth: number,
  maxHeight: number,
  baseHeight: number,
) {
  for (let scale = 12; scale >= 2; scale -= 1) {
    if (measureText(text, scale) <= maxWidth && baseHeight * scale <= maxHeight) {
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

function formatRemainingTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${String(days).padStart(2, "0")}:${String(hours).padStart(
      2,
      "0",
    )}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
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
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};
