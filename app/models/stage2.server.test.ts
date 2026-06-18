import { describe, expect, it, vi } from "vitest";

import {
  createCampaignRecommendation,
  createDiscountCodePool,
  createExperiment,
  createExperimentVariant,
  createUniqueDiscountCode,
  getExperimentWithVariants,
  listCampaignRecommendationsForShop,
  listCampaignTemplates,
  listDiscountCodePoolsForShop,
  listExperimentsForCampaign,
  listUniqueDiscountCodesForCampaign,
  recordAttributionConversion,
  recordAttributionTouch,
} from "./stage2.server";

const prismaMock = vi.hoisted(() => ({
  attributionConversion: {
    create: vi.fn(),
  },
  attributionTouch: {
    create: vi.fn(),
  },
  campaignRecommendation: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  campaignTemplate: {
    findMany: vi.fn(),
  },
  discountCodePool: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  experiment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  experimentVariant: {
    create: vi.fn(),
  },
  uniqueDiscountCode: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("../db.server", () => ({
  default: prismaMock,
}));

describe("Stage 2 data helpers", () => {
  it("creates and lists unique discount pools and codes", async () => {
    prismaMock.discountCodePool.create.mockResolvedValue({ id: "pool-1" });
    prismaMock.discountCodePool.findMany.mockResolvedValue([{ id: "pool-1" }]);
    prismaMock.uniqueDiscountCode.create.mockResolvedValue({ id: "code-1" });
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([{ id: "code-1" }]);

    await expect(
      createDiscountCodePool({
        campaignId: "campaign-1",
        discountType: "PERCENTAGE",
        prefix: "VIP",
        shopId: "shop-1",
      }),
    ).resolves.toEqual({ id: "pool-1" });
    await expect(listDiscountCodePoolsForShop("shop-1")).resolves.toEqual([
      { id: "pool-1" },
    ]);
    await expect(
      createUniqueDiscountCode({
        campaignId: "campaign-1",
        code: "VIP-001",
        shopId: "shop-1",
      }),
    ).resolves.toEqual({ id: "code-1" });
    await expect(
      listUniqueDiscountCodesForCampaign("campaign-1"),
    ).resolves.toEqual([{ id: "code-1" }]);

    expect(prismaMock.discountCodePool.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1" },
      orderBy: [{ createdAt: "desc" }],
    });
    expect(prismaMock.uniqueDiscountCode.findMany).toHaveBeenCalledWith({
      where: { campaignId: "campaign-1" },
      orderBy: [{ createdAt: "desc" }],
    });
  });

  it("creates and reads experiments with variants", async () => {
    prismaMock.experiment.create.mockResolvedValue({ id: "experiment-1" });
    prismaMock.experimentVariant.create.mockResolvedValue({ id: "variant-1" });
    prismaMock.experiment.findFirst.mockResolvedValue({
      id: "experiment-1",
      variants: [{ id: "variant-1" }],
    });
    prismaMock.experiment.findMany.mockResolvedValue([
      { id: "experiment-1", variants: [{ id: "variant-1" }] },
    ]);

    await createExperiment({
      campaignId: "campaign-1",
      name: "Headline test",
      primaryMetric: "CLICK_RATE",
      shopId: "shop-1",
    });
    await createExperimentVariant({
      campaignId: "campaign-1",
      experimentId: "experiment-1",
      name: "Control",
    });

    await expect(
      getExperimentWithVariants("experiment-1", "shop-1"),
    ).resolves.toMatchObject({
      id: "experiment-1",
      variants: [{ id: "variant-1" }],
    });
    await expect(listExperimentsForCampaign("campaign-1")).resolves.toHaveLength(
      1,
    );
  });

  it("records attribution and reads templates and recommendations", async () => {
    prismaMock.attributionTouch.create.mockResolvedValue({ id: "touch-1" });
    prismaMock.attributionConversion.create.mockResolvedValue({
      id: "conversion-1",
    });
    prismaMock.campaignTemplate.findMany.mockResolvedValue([
      { key: "template-1" },
    ]);
    prismaMock.campaignRecommendation.create.mockResolvedValue({
      id: "recommendation-1",
    });
    prismaMock.campaignRecommendation.findMany.mockResolvedValue([
      { id: "recommendation-1" },
    ]);

    await expect(
      recordAttributionTouch({
        campaignId: "campaign-1",
        eventType: "IMPRESSION",
        shopId: "shop-1",
      }),
    ).resolves.toEqual({ id: "touch-1" });
    await expect(
      recordAttributionConversion({
        attributionModel: "LAST_CLICK",
        campaignId: "campaign-1",
        orderId: "order-1",
        shopId: "shop-1",
      }),
    ).resolves.toEqual({ id: "conversion-1" });
    await expect(listCampaignTemplates({ locale: "en" })).resolves.toEqual([
      { key: "template-1" },
    ]);
    await expect(
      createCampaignRecommendation({
        description: "Try a different headline",
        shopId: "shop-1",
        title: "Improve headline",
        type: "MESSAGE",
      }),
    ).resolves.toEqual({ id: "recommendation-1" });
    await expect(
      listCampaignRecommendationsForShop("shop-1", "NEW"),
    ).resolves.toEqual([{ id: "recommendation-1" }]);

    expect(prismaMock.campaignRecommendation.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1", status: "NEW" },
      orderBy: [{ createdAt: "desc" }],
    });
  });
});
