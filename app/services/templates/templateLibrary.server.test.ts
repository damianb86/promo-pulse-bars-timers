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
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

import {
  createDraftCampaignFromTemplate,
  deleteCustomTemplate,
  getSystemCampaignTemplateInputs,
  getTemplateLocaleFallbacks,
  listTemplateLibrary,
  TemplateLibraryError,
} from "./templateLibrary.server";

const now = new Date("2026-06-18T12:00:00.000Z");

describe("template library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.campaign.create.mockResolvedValue({ id: "campaign-draft-1" });
    prismaMock.campaignTemplate.create.mockResolvedValue({ key: "custom-key" });
    prismaMock.campaignTemplate.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.campaignTemplate.findMany.mockResolvedValue([]);
    prismaMock.campaignTemplate.findUnique.mockResolvedValue(null);
    prismaMock.campaignTemplate.findFirst.mockResolvedValue(null);
  });

  it("filters templates by goal, country, locale fallback, event, and type", async () => {
    await listTemplateLibrary("shop-1", {
      country: "us",
      eventName: "Black Friday",
      goal: "FLASH_SALE",
      locale: "en-US",
      type: "COUNTDOWN_BAR",
    });

    expect(prismaMock.campaignTemplate.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            goal: "FLASH_SALE",
            type: "COUNTDOWN_BAR",
            locale: { in: ["en"] },
            eventName: { contains: "Black Friday" },
            AND: [{ OR: [{ countryCode: "US" }, { countryCode: null }] }],
          },
          { OR: [{ isSystem: true }, { shopId: "shop-1" }] },
        ],
      },
      orderBy: [
        { isSystem: "asc" },
        { category: "asc" },
        { eventName: "asc" },
        { countryCode: "asc" },
        { locale: "asc" },
      ],
    });
  });

  it("creates an editable draft campaign from a template", async () => {
    prismaMock.campaignTemplate.findFirst.mockResolvedValue(
      templateRecord("us-free-shipping-weekend"),
    );

    await expect(
      createDraftCampaignFromTemplate("shop-1", "us-free-shipping-weekend"),
    ).resolves.toEqual({ id: "campaign-draft-1" });

    expect(prismaMock.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: "shop-1",
          status: CampaignStatus.DRAFT,
          type: CampaignType.FREE_SHIPPING_GOAL,
          placements: {
            create: [
              { placementType: PlacementType.CART_DRAWER, enabled: true },
            ],
          },
          targeting: expect.objectContaining({
            create: expect.objectContaining({
              countries: ["US"],
              locales: ["en"],
            }),
          }),
          translations: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                locale: "en",
                headline: expect.stringContaining("free shipping"),
              }),
            ]),
          }),
          design: {
            create: expect.objectContaining({
              templateKey: "free-shipping",
              backgroundColor: "#ECFDF5",
              icon: "TRUCK",
              timerStyle: "BOXES",
              timerSurfaceBorderSize: 1,
            }),
          },
          freeShippingSettings: {
            create: expect.objectContaining({
              currencyCode: "USD",
              thresholdAmount: "75",
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
    expect(getTemplateLocaleFallbacks("it-IT")).toEqual(["it", "en"]);
  });

  it("defines unique system template keys across all countries and events", () => {
    const templates = getSystemCampaignTemplateInputs();
    const keys = templates.map((template) => template.key);

    expect(templates).toHaveLength(27);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("us-black-friday");
    expect(keys).toContain("us-cart-rescue");
    expect(keys).toContain("us-free-shipping-weekend");
    expect(keys).toContain("us-shipping-cutoff");
    expect(keys).toContain("us-abandoned-cart-rescue");
    expect(keys).toContain("us-cross-campaign-retargeting");
    expect(keys).toContain("us-high-intent-flash-offer");
    expect(templates.every((template) => template.countryCode === "US")).toBe(
      true,
    );
    expect(templates.every((template) => template.locale === "en")).toBe(true);
  });

  it("bundles behavior targeting and an explanation into strategy templates", () => {
    const template = getSystemCampaignTemplateInputs().find(
      (candidate) => candidate.key === "us-abandoned-cart-rescue",
    );

    expect(template).toBeDefined();

    const settings = template?.defaultSettings as {
      behaviorRules?: { enabled?: boolean; segments?: string[] };
      description?: string;
      highlights?: string[];
    };

    expect(settings.behaviorRules?.enabled).toBe(true);
    expect(settings.behaviorRules?.segments).toEqual(
      expect.arrayContaining(["INACTIVE_CART", "ADDED_TO_CART_NO_CHECKOUT"]),
    );
    expect(settings.description).toBeTruthy();
    expect(settings.highlights?.length ?? 0).toBeGreaterThan(0);
  });

  it("applies template behavior targeting when creating a draft campaign", async () => {
    prismaMock.campaignTemplate.findFirst.mockResolvedValue(
      templateRecord("us-abandoned-cart-rescue"),
    );

    await createDraftCampaignFromTemplate("shop-1", "us-abandoned-cart-rescue");

    const createArgs = prismaMock.campaign.create.mock.calls[0][0];
    const behaviorRules = createArgs.data.targeting.create.behaviorRules;

    expect(behaviorRules).toMatchObject({
      enabled: true,
      segments: expect.arrayContaining([
        "INACTIVE_CART",
        "ADDED_TO_CART_NO_CHECKOUT",
      ]),
    });
  });

  it("deletes only the shop's own custom templates", async () => {
    prismaMock.campaignTemplate.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      deleteCustomTemplate("shop-1", "custom-key"),
    ).resolves.toBeUndefined();
    expect(prismaMock.campaignTemplate.deleteMany).toHaveBeenCalledWith({
      where: { key: "custom-key", shopId: "shop-1", isSystem: false },
    });

    prismaMock.campaignTemplate.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      deleteCustomTemplate("shop-1", "us-black-friday"),
    ).rejects.toThrow(TemplateLibraryError);
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
