import {
  AnalyticsEventType,
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  type ExperimentVariant,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignVariantToVisitor,
  applyWinningVariantToCampaign,
  calculateExperimentResults,
  createExperiment,
  detectWinningVariant,
  duplicateExperiment,
  pauseExperiment,
  selectWeightedVariant,
  startExperiment,
  stopExperiment,
} from "./experiments.server";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  attributionConversion: {
    findMany: vi.fn(),
  },
  attributionTouch: {
    findMany: vi.fn(),
  },
  campaign: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  experiment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  experimentVariant: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const txMock = vi.hoisted(() => ({
  campaignDesign: {
    upsert: vi.fn(),
  },
  campaignPlacement: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  campaignTranslation: {
    upsert: vi.fn(),
  },
  discountSync: {
    upsert: vi.fn(),
  },
  experiment: {
    update: vi.fn(),
  },
  experimentVariant: {
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

describe("experiment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(txMock));
  });

  it("creates an experiment with variants", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
    prismaMock.experiment.create.mockResolvedValue({
      id: "experiment-1",
      variants: [{ id: "variant-a" }, { id: "variant-b" }],
    });

    await expect(
      createExperiment({
        shopId: "shop-1",
        campaignId: "campaign-1",
        name: "Headline test",
        primaryMetric: "CTR",
        variants: [
          { name: "Control", weight: 50 },
          { name: "Treatment", weight: 50 },
        ],
      }),
    ).resolves.toMatchObject({
      id: "experiment-1",
      variants: [{ id: "variant-a" }, { id: "variant-b" }],
    });

    expect(prismaMock.experiment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
          trafficSplitStrategy: "WEIGHTED",
        }),
      }),
    );
  });

  it("rejects direct creation when the campaign already has an experiment", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
    prismaMock.experiment.findFirst.mockResolvedValue({ id: "experiment-1" });

    await expect(
      createExperiment({
        shopId: "shop-1",
        campaignId: "campaign-1",
        name: "Second experiment",
        primaryMetric: "CTR",
      }),
    ).rejects.toThrow("This campaign already has an experiment.");
    expect(prismaMock.experiment.create).not.toHaveBeenCalled();
  });

  it("duplicates a completed experiment into a new draft", async () => {
    prismaMock.experiment.findFirst
      .mockResolvedValueOnce(
        experimentFixture({
          status: ExperimentStatus.COMPLETED,
          variants: [
            variantFixture({
              id: "winner",
              name: "Winner",
              status: ExperimentVariantStatus.WINNER,
              textOverride: { headline: "Winner headline" },
            }),
            variantFixture({
              id: "loser",
              name: "Loser",
              status: ExperimentVariantStatus.LOSER,
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(null);
    prismaMock.experiment.create.mockResolvedValue({
      id: "experiment-copy",
      variants: [],
    });

    await duplicateExperiment({
      shopId: "shop-1",
      experimentId: "experiment-1",
    });

    expect(prismaMock.experiment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Experiment copy",
          variants: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                name: "Winner",
                status: ExperimentVariantStatus.DRAFT,
                textOverride: { headline: "Winner headline" },
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it("starts, pauses, and stops experiments", async () => {
    const experiment = experimentFixture({
      status: ExperimentStatus.DRAFT,
      variants: [
        variantFixture({ id: "variant-a", weight: 50 }),
        variantFixture({ id: "variant-b", weight: 50 }),
      ],
    });

    prismaMock.experiment.findFirst.mockResolvedValue(experiment);
    prismaMock.experiment.update.mockResolvedValue(experiment);
    prismaMock.experimentVariant.updateMany.mockResolvedValue({ count: 2 });

    await startExperiment({ shopId: "shop-1", experimentId: "experiment-1" });
    await pauseExperiment({ shopId: "shop-1", experimentId: "experiment-1" });
    await stopExperiment({ shopId: "shop-1", experimentId: "experiment-1" });

    expect(prismaMock.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ExperimentStatus.RUNNING }),
      }),
    );
    expect(prismaMock.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: ExperimentStatus.PAUSED },
      }),
    );
    expect(prismaMock.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ExperimentStatus.COMPLETED }),
      }),
    );
  });

  it("keeps variant assignment stable for the same visitor", async () => {
    const experiment = experimentFixture();
    const first = selectWeightedVariant(experiment, "visitor-1");
    const second = selectWeightedVariant(experiment, "visitor-1");

    expect(first?.id).toBe(second?.id);
  });

  it("distributes visitors approximately by variant weights", () => {
    const experiment = experimentFixture({
      variants: [
        variantFixture({ id: "variant-a", weight: 70 }),
        variantFixture({ id: "variant-b", weight: 30 }),
      ],
    });
    const counts = { "variant-a": 0, "variant-b": 0 };

    for (let index = 0; index < 5000; index += 1) {
      const variant = selectWeightedVariant(experiment, `visitor-${index}`);
      counts[variant?.id as "variant-a" | "variant-b"] += 1;
    }

    const ratio =
      counts["variant-a"] / (counts["variant-a"] + counts["variant-b"]);

    expect(ratio).toBeGreaterThan(0.66);
    expect(ratio).toBeLessThan(0.74);
  });

  it("does not assign a variant for paused experiments", async () => {
    await expect(
      assignVariantToVisitor({
        visitorId: "visitor-1",
        experiment: experimentFixture({ status: ExperimentStatus.PAUSED }),
      }),
    ).resolves.toBeNull();
  });

  it("detects a CTR winner with sufficient runtime and sample", async () => {
    const results = await calculateExperimentResults({
      experiment: experimentFixture({
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      touches: [
        ...touches("variant-a", AnalyticsEventType.IMPRESSION, 100),
        ...touches("variant-a", AnalyticsEventType.CLICK, 25),
        ...touches("variant-b", AnalyticsEventType.IMPRESSION, 100),
        ...touches("variant-b", AnalyticsEventType.CLICK, 5),
      ],
      conversions: [],
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(
      detectWinningVariant(results, {
        confidenceThreshold: 0.8,
        minRuntimeHours: 1,
        minSampleSize: 50,
      }),
    ).toMatchObject({
      variantId: "variant-a",
      runnerUpVariantId: "variant-b",
    });
  });

  it("detects a revenue per visitor winner", async () => {
    const results = await calculateExperimentResults({
      experiment: experimentFixture({
        primaryMetric: ExperimentPrimaryMetric.REVENUE_PER_VISITOR,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      touches: [
        ...touches("variant-a", AnalyticsEventType.IMPRESSION, 100),
        ...touches("variant-b", AnalyticsEventType.IMPRESSION, 100),
      ],
      conversions: [
        conversion("variant-a", "order-a", "1000.00"),
        conversion("variant-b", "order-b", "200.00"),
      ],
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(
      detectWinningVariant(results, {
        confidenceThreshold: 0.8,
        minRuntimeHours: 1,
        minSampleSize: 50,
      })?.variantId,
    ).toBe("variant-a");
  });

  it("does not detect a winner with insufficient sample", async () => {
    const results = await calculateExperimentResults({
      experiment: experimentFixture(),
      touches: [
        ...touches("variant-a", AnalyticsEventType.IMPRESSION, 10),
        ...touches("variant-a", AnalyticsEventType.CLICK, 5),
        ...touches("variant-b", AnalyticsEventType.IMPRESSION, 10),
        ...touches("variant-b", AnalyticsEventType.CLICK, 1),
      ],
      conversions: [],
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(
      detectWinningVariant(results, {
        confidenceThreshold: 0.8,
        minRuntimeHours: 0,
        minSampleSize: 100,
      }),
    ).toBeNull();
  });

  it("applies winner overrides to the campaign base", async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(
      experimentFixture({
        winnerVariantId: "variant-a",
        variants: [
          variantFixture({
            id: "variant-a",
            textOverride: { headline: "Winning headline" },
            designOverride: { backgroundColor: "#064E3B" },
            discountOverride: {
              discountCode: "WINNER20",
              valueType: "PERCENTAGE",
              value: 20,
            },
            placementOverride: { placementType: "BOTTOM_BAR" },
          }),
          variantFixture({ id: "variant-b" }),
        ],
      }),
    );
    txMock.campaignPlacement.updateMany.mockResolvedValue({ count: 1 });
    txMock.experiment.update.mockResolvedValue({ id: "experiment-1" });

    await applyWinningVariantToCampaign({
      shopId: "shop-1",
      experimentId: "experiment-1",
    });

    expect(txMock.campaignTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { headline: "Winning headline" },
      }),
    );
    expect(txMock.campaignDesign.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { backgroundColor: "#064E3B" },
      }),
    );
    expect(txMock.discountSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ discountCode: "WINNER20" }),
      }),
    );
    expect(txMock.campaignPlacement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { placementType: "BOTTOM_BAR" },
      }),
    );
  });
});

function experimentFixture(
  overrides: Partial<{
    id: string;
    primaryMetric: ExperimentPrimaryMetric;
    status: ExperimentStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    winnerVariantId: string | null;
    variants: ExperimentVariant[];
  }> = {},
) {
  return {
    id: overrides.id ?? "experiment-1",
    shopId: "shop-1",
    campaignId: "campaign-1",
    name: "Experiment",
    status: overrides.status ?? ExperimentStatus.RUNNING,
    trafficSplitStrategy: "WEIGHTED",
    primaryMetric:
      overrides.primaryMetric ?? ExperimentPrimaryMetric.CLICK_RATE,
    startsAt: overrides.startsAt ?? new Date(Date.now() - 60_000),
    endsAt: overrides.endsAt ?? null,
    winnerVariantId: overrides.winnerVariantId ?? null,
    winnerDeclaredAt: null,
    autoWinnerEnabled: false,
    autoWinnerMinSampleSize: 100,
    autoWinnerMinRuntimeHours: 24,
    autoWinnerConfidenceThreshold: 0.95,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    variants: overrides.variants ?? [
      variantFixture({ id: "variant-a", weight: 50 }),
      variantFixture({ id: "variant-b", weight: 50 }),
    ],
  };
}

function variantFixture(
  overrides: Partial<ExperimentVariant> = {},
): ExperimentVariant {
  return {
    id: overrides.id ?? "variant-a",
    campaignId: overrides.campaignId ?? "campaign-1",
    experimentId: overrides.experimentId ?? "experiment-1",
    name: overrides.name ?? "Variant",
    weight: overrides.weight ?? 50,
    status: overrides.status ?? ExperimentVariantStatus.ACTIVE,
    designOverride: overrides.designOverride ?? null,
    textOverride: overrides.textOverride ?? null,
    discountOverride: overrides.discountOverride ?? null,
    placementOverride: overrides.placementOverride ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
  };
}

function touches(
  variantId: string,
  eventType: AnalyticsEventType,
  count: number,
) {
  return Array.from({ length: count }, (_, index) => ({
    variantId,
    visitorId: `${variantId}-visitor-${index}`,
    sessionId: `${variantId}-session-${index}`,
    eventType,
  }));
}

function conversion(variantId: string, orderId: string, revenueAmount: string) {
  return {
    variantId,
    visitorId: `${variantId}-buyer`,
    sessionId: `${variantId}-buyer-session`,
    orderId,
    revenueAmount,
    currencyCode: "USD",
  };
}
