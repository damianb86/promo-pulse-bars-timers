import {
  AgencyShopRole,
  CampaignStatus,
  CampaignTemplateCategory,
  Prisma,
  type Campaign,
  type Shop,
} from "@prisma/client";

import prisma from "../../db.server";
import {
  campaignDetailsInclude,
  campaignDuplicateInclude,
  type CampaignDuplicateSource,
} from "../../types/campaign";
import {
  createDraftCampaignFromTemplate,
  ensureSystemCampaignTemplates,
} from "../templates/templateLibrary.server";

export type AgencyDashboardShop = {
  id: string;
  shopifyDomain: string;
  plan: string;
  role: AgencyShopRole;
  activeCampaigns: number;
  attributedRevenue: number;
  currencyCode: string;
  openRecommendations: number;
};

export type AgencyDashboardCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  type: string;
  updatedAt: Date;
  placements: string[];
};

export type AgencyDashboardTemplate = {
  key: string;
  category: CampaignTemplateCategory;
  countryCode: string | null;
  locale: string;
  eventName: string;
  type: string;
};

export type AgencyDashboard = {
  agency: {
    id: string;
    name: string;
  };
  selectedShopId: string;
  shops: AgencyDashboardShop[];
  campaigns: AgencyDashboardCampaign[];
  templates: AgencyDashboardTemplate[];
};

type CurrentShop = Pick<Shop, "id" | "shopifyDomain">;

export class AgencyAuthorizationError extends Error {
  constructor(message = "You do not have agency access to this shop.") {
    super(message);
    this.name = "AgencyAuthorizationError";
  }
}

export async function getAgencyDashboard(
  currentShop: CurrentShop,
  selectedShopId?: string,
): Promise<AgencyDashboard> {
  const context = await getOrCreateAgencyContextForShop(currentShop);
  const accessRows = await listAgencyAccessRows(context.agency.id);
  const allowedShopIds = accessRows.map((access) => access.shopId);
  const resolvedSelectedShopId = selectedShopId || currentShop.id;

  if (!allowedShopIds.includes(resolvedSelectedShopId)) {
    throw new AgencyAuthorizationError();
  }

  await ensureSystemCampaignTemplates();

  const currencyByShop = new Map(
    accessRows.map((access) => [
      access.shopId,
      access.shop.settings?.defaultCurrency ?? "USD",
    ]),
  );
  const [metrics, campaigns, templates] = await Promise.all([
    getAgencyShopMetrics(allowedShopIds, currencyByShop),
    listCampaignsForAgencyShop(resolvedSelectedShopId),
    listAgencyTemplates(),
  ]);

  return {
    agency: {
      id: context.agency.id,
      name: context.agency.name ?? "Agency workspace",
    },
    selectedShopId: resolvedSelectedShopId,
    shops: accessRows.map((access) => {
      const metric = metrics.get(access.shopId) ?? emptyShopMetrics();

      return {
        id: access.shopId,
        shopifyDomain: access.shop.shopifyDomain,
        plan: access.shop.plan,
        role: access.role,
        activeCampaigns: metric.activeCampaigns,
        attributedRevenue: metric.attributedRevenue,
        currencyCode: metric.currencyCode,
        openRecommendations: metric.openRecommendations,
      };
    }),
    campaigns,
    templates,
  };
}

export async function copyCampaignToAgencyShop(
  currentShop: CurrentShop,
  input: {
    campaignId: string;
    sourceShopId: string;
    destinationShopId: string;
  },
) {
  const context = await getOrCreateAgencyContextForShop(currentShop);

  await Promise.all([
    assertAgencyShopAccess(context.agency.id, input.sourceShopId),
    assertAgencyShopAccess(context.agency.id, input.destinationShopId),
  ]);

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      shopId: input.sourceShopId,
    },
    include: campaignDuplicateInclude,
  });

  if (!campaign) {
    throw new AgencyAuthorizationError("Campaign is not available to copy.");
  }

  return prisma.campaign.create({
    data: buildCrossShopCampaignDraft(campaign, input.destinationShopId),
    include: campaignDetailsInclude,
  });
}

export async function copyTemplateToAgencyShop(
  currentShop: CurrentShop,
  input: {
    destinationShopId: string;
    templateKey: string;
  },
) {
  const context = await getOrCreateAgencyContextForShop(currentShop);

  await assertAgencyShopAccess(context.agency.id, input.destinationShopId);

  return createDraftCampaignFromTemplate(
    input.destinationShopId,
    input.templateKey,
  );
}

export async function assertAgencyShopAccess(agencyId: string, shopId: string) {
  const access = await prisma.agencyShopAccess.findFirst({
    where: { agencyId, shopId },
  });

  if (!access) {
    throw new AgencyAuthorizationError();
  }

  return access;
}

async function getOrCreateAgencyContextForShop(currentShop: CurrentShop) {
  const existingAccess = await prisma.agencyShopAccess.findFirst({
    where: { shopId: currentShop.id },
    include: { agency: true },
    orderBy: { createdAt: "asc" },
  });

  if (existingAccess) {
    return {
      agency: existingAccess.agency,
      role: existingAccess.role,
    };
  }

  const agency = await prisma.agencyAccount.create({
    data: {
      name: `${currentShop.shopifyDomain} agency workspace`,
      shopAccesses: {
        create: {
          shopId: currentShop.id,
          role: AgencyShopRole.OWNER,
        },
      },
    },
  });

  return {
    agency,
    role: AgencyShopRole.OWNER,
  };
}

async function listAgencyAccessRows(agencyId: string) {
  return prisma.agencyShopAccess.findMany({
    where: { agencyId },
    include: {
      shop: {
        include: {
          settings: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

async function getAgencyShopMetrics(
  shopIds: string[],
  currencyByShop: Map<string, string>,
) {
  const entries = await Promise.all(
    shopIds.map(async (shopId) => {
      const [activeCampaigns, revenue, openRecommendations] = await Promise.all(
        [
          prisma.campaign.count({
            where: { shopId, status: CampaignStatus.ACTIVE },
          }),
          prisma.attributionConversion.aggregate({
            where: { shopId },
            _sum: { revenueAmount: true },
          }),
          prisma.campaignRecommendation.count({
            where: {
              shopId,
              status: { in: ["NEW", "VIEWED"] },
            },
          }),
        ],
      );

      return [
        shopId,
        {
          activeCampaigns,
          attributedRevenue: toNumber(revenue._sum.revenueAmount),
          currencyCode: currencyByShop.get(shopId) ?? "USD",
          openRecommendations,
        },
      ] as const;
    }),
  );

  return new Map(entries);
}

async function listCampaignsForAgencyShop(shopId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { shopId },
    include: { placements: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 12,
  });

  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    type: campaign.type,
    updatedAt: campaign.updatedAt,
    placements: campaign.placements.map((placement) => placement.placementType),
  }));
}

async function listAgencyTemplates() {
  const templates = await prisma.campaignTemplate.findMany({
    where: { isSystem: true },
    select: {
      key: true,
      category: true,
      countryCode: true,
      locale: true,
      eventName: true,
      type: true,
    },
    orderBy: [
      { category: "asc" },
      { eventName: "asc" },
      { countryCode: "asc" },
      { locale: "asc" },
    ],
    take: 40,
  });

  return templates.map((template) => ({
    key: template.key,
    category: template.category,
    countryCode: template.countryCode,
    locale: template.locale,
    eventName: template.eventName,
    type: template.type,
  }));
}

function buildCrossShopCampaignDraft(
  campaign: CampaignDuplicateSource,
  destinationShopId: string,
): Prisma.CampaignCreateInput {
  return {
    shop: { connect: { id: destinationShopId } },
    name: buildAgencyCampaignCopyName(campaign),
    status: CampaignStatus.DRAFT,
    type: campaign.type,
    goal: campaign.goal,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    timezone: campaign.timezone,
    priority: campaign.priority,
    placements: {
      create: campaign.placements.map((placement) => ({
        placementType: placement.placementType,
        customSelector: placement.customSelector,
        enabled: placement.enabled,
      })),
    },
    ...(campaign.targeting
      ? {
          targeting: {
            create: {
              countries: campaign.targeting.countries as Prisma.InputJsonValue,
              markets: campaign.targeting.markets as Prisma.InputJsonValue,
              locales: campaign.targeting.locales as Prisma.InputJsonValue,
              productIds: campaign.targeting
                .productIds as Prisma.InputJsonValue,
              collectionIds: campaign.targeting
                .collectionIds as Prisma.InputJsonValue,
              productTags: campaign.targeting
                .productTags as Prisma.InputJsonValue,
              customerTags: campaign.targeting
                .customerTags as Prisma.InputJsonValue,
              urlContains: campaign.targeting
                .urlContains as Prisma.InputJsonValue,
              utmSources: campaign.targeting
                .utmSources as Prisma.InputJsonValue,
              devices: campaign.targeting.devices as Prisma.InputJsonValue,
              excludeProductIds: campaign.targeting
                .excludeProductIds as Prisma.InputJsonValue,
              excludeCollectionIds: campaign.targeting
                .excludeCollectionIds as Prisma.InputJsonValue,
              behaviorRules: toInputJsonOrNull(
                campaign.targeting.behaviorRules,
              ),
            },
          },
        }
      : {}),
    ...(campaign.design
      ? {
          design: {
            create: {
              templateKey: campaign.design.templateKey,
              layout: campaign.design.layout,
              backgroundType: campaign.design.backgroundType,
              backgroundColor: campaign.design.backgroundColor,
              gradientStartColor: campaign.design.gradientStartColor,
              gradientEndColor: campaign.design.gradientEndColor,
              gradientAngle: campaign.design.gradientAngle,
              textColor: campaign.design.textColor,
              accentColor: campaign.design.accentColor,
              buttonColor: campaign.design.buttonColor,
              buttonTextColor: campaign.design.buttonTextColor,
              fontSize: campaign.design.fontSize,
              borderRadius: campaign.design.borderRadius,
              borderSize: campaign.design.borderSize,
              borderColor: campaign.design.borderColor,
              fontFamily: campaign.design.fontFamily,
              titleFontSize: campaign.design.titleFontSize,
              titleColor: campaign.design.titleColor,
              subheadingFontSize: campaign.design.subheadingFontSize,
              subheadingColor: campaign.design.subheadingColor,
              timerFontSize: campaign.design.timerFontSize,
              timerColor: campaign.design.timerColor,
              legendFontSize: campaign.design.legendFontSize,
              legendColor: campaign.design.legendColor,
              timerStyle: campaign.design.timerStyle,
              timerFormat: campaign.design.timerFormat,
              timerShowLabels: campaign.design.timerShowLabels,
              timerSurfaceColor: campaign.design.timerSurfaceColor,
              timerSurfaceBorderColor: campaign.design.timerSurfaceBorderColor,
              timerSurfaceBorderSize: campaign.design.timerSurfaceBorderSize,
              timerSurfaceRadius: campaign.design.timerSurfaceRadius,
              paddingBlock: campaign.design.paddingBlock,
              paddingInline: campaign.design.paddingInline,
              contentGap: campaign.design.contentGap,
              fullWidth: campaign.design.fullWidth,
              positionMode: campaign.design.positionMode,
              positionSticky: campaign.design.positionSticky,
              customCss: campaign.design.customCss,
              mobileEnabled: campaign.design.mobileEnabled,
              alignment: campaign.design.alignment,
              showCloseButton: campaign.design.showCloseButton,
              showIcon: campaign.design.showIcon,
              icon: campaign.design.icon,
              customIconUrl: campaign.design.customIconUrl,
            },
          },
        }
      : {}),
    ...(campaign.timerSettings
      ? {
          timerSettings: {
            create: {
              mode: campaign.timerSettings.mode,
              durationMinutes: campaign.timerSettings.durationMinutes,
              recurringDays: campaign.timerSettings
                .recurringDays as Prisma.InputJsonValue,
              resetBehavior: campaign.timerSettings.resetBehavior,
            },
          },
        }
      : {}),
    ...(campaign.freeShippingSettings
      ? {
          freeShippingSettings: {
            create: {
              thresholdAmount: campaign.freeShippingSettings.thresholdAmount,
              currencyCode: campaign.freeShippingSettings.currencyCode,
              includeDiscountedSubtotal:
                campaign.freeShippingSettings.includeDiscountedSubtotal,
              emptyCartMessage: campaign.freeShippingSettings.emptyCartMessage,
              successMessage: campaign.freeShippingSettings.successMessage,
              progressStyle: campaign.freeShippingSettings.progressStyle,
              thresholdRules: toInputJsonOrNull(
                campaign.freeShippingSettings.thresholdRules,
              ),
            },
          },
        }
      : {}),
    ...(campaign.deliveryCutoffSettings
      ? {
          deliveryCutoffSettings: {
            create: {
              cutoffHour: campaign.deliveryCutoffSettings.cutoffHour,
              cutoffMinute: campaign.deliveryCutoffSettings.cutoffMinute,
              processingDays: campaign.deliveryCutoffSettings.processingDays,
              minDeliveryDays: campaign.deliveryCutoffSettings.minDeliveryDays,
              maxDeliveryDays: campaign.deliveryCutoffSettings.maxDeliveryDays,
              workingDays: campaign.deliveryCutoffSettings
                .workingDays as Prisma.InputJsonValue,
              holidays: campaign.deliveryCutoffSettings
                .holidays as Prisma.InputJsonValue,
              countryRules: campaign.deliveryCutoffSettings
                .countryRules as Prisma.InputJsonValue,
              afterCutoffBehavior:
                campaign.deliveryCutoffSettings.afterCutoffBehavior,
            },
          },
        }
      : {}),
    ...(campaign.lowStockSettings
      ? {
          lowStockSettings: {
            create: {
              threshold: campaign.lowStockSettings.threshold,
              showExactQuantity: campaign.lowStockSettings.showExactQuantity,
              fallbackMessage: campaign.lowStockSettings.fallbackMessage,
            },
          },
        }
      : {}),
    ...(campaign.badgeSettings
      ? {
          badgeSettings: {
            create: {
              badgeText: campaign.badgeSettings.badgeText,
              badgeShape: campaign.badgeSettings.badgeShape,
              badgePosition: campaign.badgeSettings.badgePosition,
            },
          },
        }
      : {}),
    ...(campaign.marketCampaignRules.length > 0
      ? {
          marketCampaignRules: {
            create: campaign.marketCampaignRules.map((rule) => ({
              shop: { connect: { id: destinationShopId } },
              enabled: rule.enabled,
              marketId: rule.marketId,
              countryCode: rule.countryCode,
              locale: rule.locale,
              currencyCode: rule.currencyCode,
              thresholdAmount: rule.thresholdAmount,
              deliverySettings: toInputJsonOrNull(rule.deliverySettings),
              textOverrides: toInputJsonOrNull(rule.textOverrides),
            })),
          },
        }
      : {}),
    translations: {
      create: campaign.translations.map((translation) => ({
        locale: translation.locale,
        headline: translation.headline,
        subheadline: translation.subheadline,
        ctaText: translation.ctaText,
        ctaUrl: translation.ctaUrl,
        expiredText: translation.expiredText,
        freeShippingEmptyText: translation.freeShippingEmptyText,
        freeShippingProgressText: translation.freeShippingProgressText,
        freeShippingSuccessText: translation.freeShippingSuccessText,
        deliveryBeforeCutoffText: translation.deliveryBeforeCutoffText,
        deliveryAfterCutoffText: translation.deliveryAfterCutoffText,
        lowStockText: translation.lowStockText,
        badgeText: translation.badgeText,
      })),
    },
  };
}

function buildAgencyCampaignCopyName(campaign: Pick<Campaign, "name">) {
  return `${campaign.name} agency copy`;
}

function toInputJsonOrNull(value: Prisma.JsonValue | null | undefined) {
  return value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function emptyShopMetrics() {
  return {
    activeCampaigns: 0,
    attributedRevenue: 0,
    currencyCode: "USD",
    openRecommendations: 0,
  };
}
