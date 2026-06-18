import {
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  type ExperimentVariant,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignVariantToVisitor,
  createExperiment,
  pauseExperiment,
  selectWeightedVariant,
  startExperiment,
  stopExperiment,
} from "./experiments.server";

const prismaMock = vi.hoisted(() => ({
  campaign: {
    findFirst: vi.fn(),
  },
  experiment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  experimentVariant: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

describe("experiment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

function experimentFixture(
  overrides: Partial<{
    id: string;
    status: ExperimentStatus;
    startsAt: Date | null;
    endsAt: Date | null;
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
    primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
    startsAt: overrides.startsAt ?? new Date(Date.now() - 60_000),
    endsAt: overrides.endsAt ?? null,
    winnerVariantId: null,
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
