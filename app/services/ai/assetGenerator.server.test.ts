import { describe, expect, it } from "vitest";

import { chooseOpenAiImageSize } from "./assetGenerator.server";

describe("chooseOpenAiImageSize", () => {
  it("honors an explicit generated asset image size", () => {
    expect(
      chooseOpenAiImageSize({
        type: "background",
        prompt: "wide campaign background",
        imageSize: "1024x1536",
      }),
    ).toBe("1024x1536");
  });

  it("uses landscape canvas for wide campaign backgrounds", () => {
    expect(
      chooseOpenAiImageSize({
        type: "background",
        prompt: "premium horizontal top bar banner background",
      }),
    ).toBe("1536x1024");
  });

  it("uses square canvas for compact icons and badges", () => {
    expect(
      chooseOpenAiImageSize({
        type: "icon",
        prompt: "small lightning icon",
      }),
    ).toBe("1024x1024");
  });

  it("uses the reference region aspect ratio when available", () => {
    expect(
      chooseOpenAiImageSize({
        type: "image",
        prompt: "recreate the cropped visual",
        region: { x: 0.1, y: 0.1, width: 0.2, height: 0.6 },
      }),
    ).toBe("1024x1536");
  });
});
