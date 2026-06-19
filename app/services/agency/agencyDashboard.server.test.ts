import {
  AgencyShopRole,
  CampaignDesignIcon,
  CampaignGoal,
  CampaignStatus,
  CampaignTemplateCategory,
  CampaignType,
  DesignAlignment,
  PlacementType,
  Prisma,
  ShopPlan,
  TimerMode,
  TimerResetBehavior,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  agencyAccount: {
    create: vi.fn(),
  },
  agencyShopAccess: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  attributionConversion: {
    aggregate: vi.fn(),
  },
  campaign: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  campaignRecommendation: {
    count: vi.fn(),
  },
  campaignTemplate: {
    findMany: vi.fn(),
  },
}));

const templateLibraryMock = vi.hoisted(() => ({
  createDraftCampaignFromTemplate: vi.fn(),
  ensureSystemCampaignTemplates: vi.fn(),
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

vi.mock("../templates/templateLibrary.server", () => templateLibraryMock);

import {
  AgencyAuthorizationError,
  copyCampaignToAgencyShop,
  copyTemplateToAgencyShop,
  getAgencyDashboard,
} from "./agencyDashboard.server";

const now = new Date("2026-06-19T12:00:00.000Z");
const currentShop = {
  id: "shop-1",
  shopifyDomain: "demo-shop.myshopify.com",
};

describe("agency dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgencyAccess();
    prismaMock.agencyAccount.create.mockResolvedValue({
      id: "agency-1",
      name: "E2E Promo Agency",
    });
    prismaMock.agencyShopAccess.findMany.mockResolvedValue([
      agencyAccess("shop-1", "demo-shop.myshopify.com", AgencyShopRole.OWNER),
      agencyAccess(
        "shop-2",
        "agency-second.myshopify.com",
        AgencyShopRole.ADMIN,
      ),
    ]);
    prismaMock.campaign.count.mockImplementation(({ where }) =>
      Promise.resolve(where.shopId === "shop-1" ? 1 : 2),
    );
    prismaMock.attributionConversion.aggregate.mockImplementation(({ where }) =>
      Promise.resolve({
        _sum: {
          revenueAmount: new Prisma.Decimal(
            where.shopId === "shop-1" ? 320 : 540,
          ),
        },
      }),
    );
    prismaMock.campaignRecommendation.count.mockImplementation(({ where }) =>
      Promise.resolve(where.shopId === "shop-2" ? 1 : 0),
    );
    prismaMock.campaign.findMany.mockResolvedValue([campaignListRecord()]);
    prismaMock.campaignTemplate.findMany.mockResolvedValue([templateRecord()]);
    prismaMock.campaign.findFirst.mockResolvedValue(campaignCopySource());
    prismaMock.campaign.create.mockResolvedValue({
      id: "campaign-copy-1",
      status: CampaignStatus.DRAFT,
    });
    templateLibraryMock.createDraftCampaignFromTemplate.mockResolvedValue({
      id: "template-copy-1",
    });
    templateLibraryMock.ensureSystemCampaignTemplates.mockResolvedValue(120);
  });

  it("shows only shops assigned to the current agency", async () => {
    const dashboard = await getAgencyDashboard(currentShop);

    expect(dashboard.shops).toHaveLength(2);
    expect(dashboard.shops.map((shop) => shop.shopifyDomain)).toEqual([
      "demo-shop.myshopify.com",
      "agency-second.myshopify.com",
    ]);
    expect(
      dashboard.shops.some(
        (shop) => shop.shopifyDomain === "agency-hidden.myshopify.com",
      ),
    ).toBe(false);
  });

  it("aggregates attributed revenue and recommendations by shop", async () => {
    const dashboard = await getAgencyDashboard(currentShop, "shop-2");

    expect(dashboard.selectedShopId).toBe("shop-2");
    expect(dashboard.shops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "shop-1",
          activeCampaigns: 1,
          attributedRevenue: 320,
          openRecommendations: 0,
        }),
        expect.objectContaining({
          id: "shop-2",
          activeCampaigns: 2,
          attributedRevenue: 540,
          openRecommendations: 1,
        }),
      ]),
    );
  });

  it("blocks access to shops without AgencyShopAccess", async () => {
    await expect(
      copyCampaignToAgencyShop(currentShop, {
        campaignId: "campaign-1",
        sourceShopId: "shop-1",
        destinationShopId: "hidden-shop",
      }),
    ).rejects.toBeInstanceOf(AgencyAuthorizationError);

    expect(prismaMock.campaign.create).not.toHaveBeenCalled();
  });

  it("copies a campaign to another assigned shop as a draft", async () => {
    await expect(
      copyCampaignToAgencyShop(currentShop, {
        campaignId: "campaign-1",
        sourceShopId: "shop-1",
        destinationShopId: "shop-2",
      }),
    ).resolves.toEqual({
      id: "campaign-copy-1",
      status: CampaignStatus.DRAFT,
    });

    const createArg = prismaMock.campaign.create.mock.calls[0]?.[0];

    expect(createArg).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          shop: { connect: { id: "shop-2" } },
          name: "Agency Source agency copy",
          status: CampaignStatus.DRAFT,
          type: CampaignType.COUNTDOWN_BAR,
          translations: {
            create: [
              expect.objectContaining({
                locale: "en",
                headline: "Agency source campaign",
              }),
            ],
          },
        }),
      }),
    );
    expect(createArg.data).not.toHaveProperty("discountSync");
  });

  it("copies a system template to an assigned shop as a draft", async () => {
    await expect(
      copyTemplateToAgencyShop(currentShop, {
        destinationShopId: "shop-2",
        templateKey: "us-black-friday",
      }),
    ).resolves.toEqual({ id: "template-copy-1" });

    expect(
      templateLibraryMock.createDraftCampaignFromTemplate,
    ).toHaveBeenCalledWith("shop-2", "us-black-friday");
  });
});

function mockAgencyAccess() {
  prismaMock.agencyShopAccess.findFirst.mockImplementation(
    ({ where, include }) => {
      if (where.shopId === "hidden-shop") return Promise.resolve(null);

      if (include?.agency) {
        return Promise.resolve({
          agencyId: "agency-1",
          shopId: where.shopId,
          role: AgencyShopRole.OWNER,
          agency: {
            id: "agency-1",
            name: "E2E Promo Agency",
          },
          createdAt: now,
        });
      }

      return Promise.resolve({
        agencyId: where.agencyId,
        shopId: where.shopId,
        role:
          where.shopId === "shop-1"
            ? AgencyShopRole.OWNER
            : AgencyShopRole.ADMIN,
        createdAt: now,
      });
    },
  );
}

function agencyAccess(
  shopId: string,
  shopifyDomain: string,
  role: AgencyShopRole,
) {
  return {
    agencyId: "agency-1",
    shopId,
    role,
    createdAt: now,
    shop: {
      id: shopId,
      shopifyDomain,
      plan: ShopPlan.PRO,
      createdAt: now,
      updatedAt: now,
      settings: {
        shopId,
        defaultLocale: "en",
        enabledLocales: ["en"],
        defaultTimezone: "UTC",
        defaultCurrency: "USD",
        enableDebugMode: false,
        brandName: null,
        supportEmail: null,
        defaultCountry: "US",
        customCartDrawerSelector: null,
        customCartPageSelector: null,
        customProductFormSelector: null,
        analyticsEnabled: true,
        respectDoNotTrack: true,
        consentMode: "BASIC",
        createdAt: now,
        updatedAt: now,
      },
    },
  };
}

function campaignListRecord() {
  return {
    id: "campaign-1",
    shopId: "shop-2",
    name: "Second shop campaign",
    status: CampaignStatus.ACTIVE,
    type: CampaignType.COUNTDOWN_BAR,
    goal: CampaignGoal.FLASH_SALE,
    startsAt: null,
    endsAt: null,
    timezone: "UTC",
    priority: 0,
    createdAt: now,
    updatedAt: now,
    placements: [{ placementType: PlacementType.TOP_BAR }],
  };
}

function campaignCopySource() {
  return {
    id: "campaign-1",
    shopId: "shop-1",
    name: "Agency Source",
    status: CampaignStatus.ACTIVE,
    type: CampaignType.COUNTDOWN_BAR,
    goal: CampaignGoal.FLASH_SALE,
    startsAt: null,
    endsAt: null,
    timezone: "UTC",
    priority: 0,
    createdAt: now,
    updatedAt: now,
    placements: [
      {
        id: "placement-1",
        campaignId: "campaign-1",
        placementType: PlacementType.TOP_BAR,
        customSelector: null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    targeting: null,
    design: {
      id: "design-1",
      campaignId: "campaign-1",
      templateKey: "flash",
      backgroundColor: "#111827",
      textColor: "#ffffff",
      accentColor: "#22c55e",
      buttonColor: "#ffffff",
      buttonTextColor: "#111827",
      fontSize: 14,
      borderRadius: 8,
      positionSticky: true,
      customCss: null,
      mobileEnabled: true,
      alignment: DesignAlignment.CENTER,
      showCloseButton: false,
      showIcon: true,
      icon: CampaignDesignIcon.FIRE,
      createdAt: now,
      updatedAt: now,
    },
    timerSettings: {
      id: "timer-1",
      campaignId: "campaign-1",
      mode: TimerMode.FIXED_DATE,
      durationMinutes: null,
      recurringDays: [],
      resetBehavior: TimerResetBehavior.NEVER,
      createdAt: now,
      updatedAt: now,
    },
    freeShippingSettings: null,
    deliveryCutoffSettings: null,
    lowStockSettings: null,
    badgeSettings: null,
    discountSync: {
      id: "discount-1",
      campaignId: "campaign-1",
      shopifyDiscountId: "gid://shopify/DiscountCodeNode/1",
      discountCode: "SOURCE10",
      method: "CODE",
      syncStartEnd: false,
      lastSyncedAt: now,
      title: "Source discount",
      valueType: "PERCENTAGE",
      value: "10",
      minimumSubtotal: null,
      appliesOncePerCustomer: true,
      uniqueCodePrefix: null,
      uniqueCodeExpiresMinutes: null,
      uniqueCodeAutoApply: false,
      uniqueCodeStartsAt: null,
      uniqueCodeEndsAt: null,
      createdAt: now,
      updatedAt: now,
    },
    marketCampaignRules: [],
    translations: [
      {
        id: "translation-1",
        campaignId: "campaign-1",
        locale: "en",
        headline: "Agency source campaign",
        subheadline: "Cross-store copy source.",
        ctaText: "Shop source",
        ctaUrl: "/collections/sale",
        expiredText: "Expired.",
        freeShippingEmptyText: null,
        freeShippingProgressText: null,
        freeShippingSuccessText: null,
        deliveryBeforeCutoffText: null,
        deliveryAfterCutoffText: null,
        lowStockText: null,
        badgeText: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function templateRecord() {
  return {
    key: "us-black-friday",
    category: CampaignTemplateCategory.BFCM,
    countryCode: "US",
    locale: "en",
    eventName: "Black Friday",
    type: CampaignType.COUNTDOWN_BAR,
  };
}
