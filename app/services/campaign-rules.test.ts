import { describe, expect, it } from "vitest";

import {
  buildDuplicateCampaignName,
  getCampaignStatusAfterTransition,
  validateActivationCandidate,
} from "./campaign-rules";

describe("campaign status rules", () => {
  it("activates campaigns from editable statuses", () => {
    expect(getCampaignStatusAfterTransition("DRAFT", "activate")).toBe(
      "ACTIVE",
    );
    expect(getCampaignStatusAfterTransition("PAUSED", "activate")).toBe(
      "ACTIVE",
    );
  });

  it("pauses active campaigns", () => {
    expect(getCampaignStatusAfterTransition("ACTIVE", "pause")).toBe("PAUSED");
  });

  it("expires non-expired campaigns", () => {
    expect(getCampaignStatusAfterTransition("ACTIVE", "expire")).toBe(
      "EXPIRED",
    );
  });
});

describe("campaign activation validation", () => {
  it("requires a placement and headline before activation", () => {
    expect(
      validateActivationCandidate({
        placements: [],
        translations: [{ headline: "" }],
      }),
    ).toEqual([
      "An active campaign needs at least one enabled placement.",
      "An active campaign needs a basic headline translation.",
    ]);
  });

  it("passes when a campaign has an enabled placement and headline", () => {
    expect(
      validateActivationCandidate({
        placements: [{ enabled: true }],
        translations: [{ headline: "Sale ends tonight" }],
      }),
    ).toEqual([]);
  });
});

describe("campaign duplication rules", () => {
  it("builds a clear duplicate name", () => {
    expect(buildDuplicateCampaignName("Flash Sale")).toBe("Flash Sale copy");
  });

  it("uses a fallback duplicate name for blank names", () => {
    expect(buildDuplicateCampaignName(" ")).toBe("Untitled campaign copy");
  });
});
