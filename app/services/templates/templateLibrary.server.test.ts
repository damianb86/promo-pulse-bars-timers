import {
  CampaignStatus,
  CampaignType,
  PlacementType,
  Prisma,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campaign: {
    create: vi.fn(),
  },
  campaignTemplate: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

import {
  createDraftCampaignFromTemplate,
  getSystemCampaignTemplateInputs,
  getTemplateLocaleFallbacks,
  listTemplateLibrary,
} from "./templateLibrary.server";

const now = new Date("2026-06-18T12:00:00.000Z");

describe("template library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.campaign.create.mockResolvedValue({ id: "campaign-draft-1" });
    prismaMock.campaignTemplate.findMany.mockResolvedValue([]);
    prismaMock.campaignTemplate.findUnique.mockResolvedValue(null);
  });

  it("filters templates by goal, country, locale fallback, event, and type", async () => {
    await listTemplateLibrary({
      country: "mx",
      eventName: "Buen Fin",
      goal: "FLASH_SALE",
      locale: "es-MX",
      type: "COUNTDOWN_BAR",
    });

    expect(prismaMock.campaignTemplate.findMany).toHaveBeenCalledWith({
      where: {
        goal: "FLASH_SALE",
        type: "COUNTDOWN_BAR",
        OR: [{ countryCode: "MX" }, { countryCode: null }],
        locale: { in: ["es", "en"] },
        eventName: { contains: "Buen Fin" },
      },
      orderBy: [
        { category: "asc" },
        { eventName: "asc" },
        { countryCode: "asc" },
        { locale: "asc" },
      ],
    });
  });

  it("creates an editable draft campaign from a template", async () => {
    prismaMock.campaignTemplate.findUnique.mockResolvedValue(
      templateRecord("br-free-shipping-weekend"),
    );

    await expect(
      createDraftCampaignFromTemplate("shop-1", "br-free-shipping-weekend"),
    ).resolves.toEqual({ id: "campaign-draft-1" });

    expect(prismaMock.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: "shop-1",
          status: CampaignStatus.DRAFT,
          type: CampaignType.FREE_SHIPPING_GOAL,
          placements: {
            create: [{ placementType: PlacementType.CART_DRAWER, enabled: true }],
          },
          targeting: expect.objectContaining({
            create: expect.objectContaining({
              countries: ["BR"],
              locales: ["pt-BR"],
            }),
          }),
          translations: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                locale: "pt-BR",
                headline: expect.stringContaining("frete gratis"),
              }),
            ]),
          }),
          design: {
            create: expect.objectContaining({
              templateKey: "free-shipping",
              icon: "TRUCK",
            }),
          },
          freeShippingSettings: {
            create: expect.objectContaining({
              currencyCode: "BRL",
              thresholdAmount: "350",
            }),
          },
        }),
        select: { id: true },
      }),
    );
  });

  it("falls back from regional locales to the supported base locale and English", () => {
    expect(getTemplateLocaleFallbacks("es-MX")).toEqual(["es", "en"]);
    expect(getTemplateLocaleFallbacks("pt")).toEqual(["pt-BR", "en"]);
    expect(getTemplateLocaleFallbacks("it-IT")).toEqual(["en"]);
  });

  it("defines unique system template keys across all countries and events", () => {
    const templates = getSystemCampaignTemplateInputs();
    const keys = templates.map((template) => template.key);

    expect(templates).toHaveLength(120);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("us-black-friday");
    expect(keys).toContain("mx-buen-fin");
    expect(keys).toContain("ar-hot-sale");
    expect(keys).toContain("br-free-shipping-weekend");
  });
});

function templateRecord(key: string) {
  const template = getSystemCampaignTemplateInputs().find(
    (candidate) => candidate.key === key,
  );

  if (!template) throw new Error(`Missing test template ${key}`);

  return {
    id: `template-${key}`,
    createdAt: now,
    updatedAt: now,
    ...template,
    defaultTexts: template.defaultTexts as Prisma.JsonValue,
    defaultDesign: template.defaultDesign as Prisma.JsonValue,
    defaultSettings: template.defaultSettings as Prisma.JsonValue,
  };
}
