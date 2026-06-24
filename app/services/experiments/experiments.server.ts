import {
  AnalyticsEventType,
  CampaignDesignIcon,
  DesignBackgroundType,
  DesignBannerAnimation,
  DesignAlignment,
  DesignFontFamily,
  DesignLayout,
  DesignPositionMode,
  DesignTimerFormat,
  DesignTimerStyle,
  DesignTimerTickAnimation,
  DiscountCodeValueType,
  DiscountSyncMethod,
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  PlacementType,
  Prisma,
  type Experiment,
  type ExperimentVariant,
} from "@prisma/client";

import prisma from "../../db.server";

export type ExperimentVariantInput = {
  id?: string;
  name: string;
  weight: number;
  status?: ExperimentVariantStatus;
  designOverride?: unknown;
  textOverride?: unknown;
  discountOverride?: unknown;
  placementOverride?: unknown;
};

export type CreateExperimentInput = {
  shopId: string;
  campaignId: string;
  name: string;
  trafficSplitStrategy?: string;
  primaryMetric: ExperimentPrimaryMetric | "CTR";
  variants?: ExperimentVariantInput[];
};

export type UpdateExperimentInput = {
  shopId: string;
  experimentId: string;
  name?: string;
  trafficSplitStrategy?: string;
  primaryMetric?: ExperimentPrimaryMetric | "CTR";
  variants?: ExperimentVariantInput[];
};

export type DuplicateExperimentInput = {
  shopId: string;
  experimentId: string;
};

export type ExperimentWithVariants = Experiment & {
  variants: ExperimentVariant[];
};

type ExperimentWithAutoWinner = ExperimentWithVariants & {
  autoWinnerEnabled: boolean;
  autoWinnerMinSampleSize: number;
  autoWinnerMinRuntimeHours: number;
  autoWinnerConfidenceThreshold: number;
  winnerDeclaredAt: Date | null;
  winnerAppliedAt?: Date | null;
};

export type AutoWinnerSettingsInput = {
  enabled?: boolean;
  minSampleSize?: number;
  minRuntimeHours?: number;
  confidenceThreshold?: number;
};

export type ExperimentTouchRecord = {
  variantId: string | null;
  visitorId: string | null;
  sessionId: string | null;
  eventType: AnalyticsEventType;
};

export type ExperimentConversionRecord = {
  variantId: string | null;
  visitorId: string | null;
  sessionId: string | null;
  orderId: string;
  revenueAmount: { toString(): string } | number | string | null;
  currencyCode: string | null;
};

export type ExperimentVariantResult = {
  variantId: string;
  variantName: string;
  status: ExperimentVariantStatus;
  impressions: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  addToCartRate: number;
  checkoutStarted: number;
  checkoutRate: number;
  orders: number;
  revenue: number;
  revenuePerVisitor: number;
  conversionRate: number;
  visitors: number;
  primaryMetricValue: number;
};

export type ExperimentResults = {
  experimentId: string;
  campaignId: string;
  status: ExperimentStatus;
  primaryMetric: ExperimentPrimaryMetric;
  winnerVariantId: string | null;
  runtimeHours: number;
  currencyCode: string;
  autoWinner: {
    enabled: boolean;
    minSampleSize: number;
    minRuntimeHours: number;
    confidenceThreshold: number;
  };
  variants: ExperimentVariantResult[];
};

export type WinningVariantDetection = {
  variantId: string;
  confidenceScore: number;
  primaryMetricValue: number;
  runnerUpVariantId: string;
  runnerUpMetricValue: number;
};

export type AssignVariantInput =
  | {
      experiment: ExperimentWithVariants;
      visitorId: string | null | undefined;
      now?: Date;
    }
  | {
      experimentId: string;
      shopId: string;
      visitorId: string | null | undefined;
      now?: Date;
    };

const assignableVariantStatuses = new Set<ExperimentVariantStatus>([
  ExperimentVariantStatus.ACTIVE,
  ExperimentVariantStatus.WINNER,
]);

export async function createExperiment(input: CreateExperimentInput) {
  await assertCampaignBelongsToShop(input.campaignId, input.shopId);
  await assertCampaignHasNoOpenExperiment(input.campaignId, input.shopId);

  const experiment = await prisma.experiment.create({
    data: {
      shopId: input.shopId,
      campaignId: input.campaignId,
      name: input.name.trim() || "Campaign experiment",
      trafficSplitStrategy: input.trafficSplitStrategy?.trim() || "WEIGHTED",
      primaryMetric: normalizePrimaryMetric(input.primaryMetric),
      variants: input.variants?.length
        ? {
            create: input.variants.map((variant) =>
              toVariantCreateInput(input.campaignId, variant),
            ),
          }
        : undefined,
    },
    include: experimentInclude,
  });

  await markCampaignSaved(input.campaignId, input.shopId);

  return experiment;
}

export async function duplicateExperiment(input: DuplicateExperimentInput) {
  const sourceExperiment = await prisma.experiment.findFirst({
    where: { id: input.experimentId, shopId: input.shopId },
    include: experimentInclude,
  });

  if (!sourceExperiment) {
    throw new Error("Experiment not found.");
  }

  if (sourceExperiment.status !== ExperimentStatus.COMPLETED) {
    throw new Error("Only completed experiments can be duplicated.");
  }

  await assertCampaignHasNoOpenExperiment(
    sourceExperiment.campaignId,
    input.shopId,
  );

  const experiment = await prisma.experiment.create({
    data: {
      shopId: input.shopId,
      campaignId: sourceExperiment.campaignId,
      name: buildDuplicateExperimentName(sourceExperiment.name),
      trafficSplitStrategy: sourceExperiment.trafficSplitStrategy,
      primaryMetric: sourceExperiment.primaryMetric,
      autoWinnerEnabled: sourceExperiment.autoWinnerEnabled,
      autoWinnerMinSampleSize: sourceExperiment.autoWinnerMinSampleSize,
      autoWinnerMinRuntimeHours: sourceExperiment.autoWinnerMinRuntimeHours,
      autoWinnerConfidenceThreshold:
        sourceExperiment.autoWinnerConfidenceThreshold,
      variants: {
        create: sourceExperiment.variants
          .filter(
            (variant) => variant.status !== ExperimentVariantStatus.ARCHIVED,
          )
          .map((variant) =>
            toVariantCreateInput(sourceExperiment.campaignId, {
              name: variant.name,
              weight: variant.weight,
              status: ExperimentVariantStatus.DRAFT,
              designOverride: jsonObject(variant.designOverride),
              textOverride: jsonObject(variant.textOverride),
              discountOverride: jsonObject(variant.discountOverride),
              placementOverride: jsonObject(variant.placementOverride),
            }),
          ),
      },
    },
    include: experimentInclude,
  });

  await markCampaignSaved(sourceExperiment.campaignId, input.shopId);

  return experiment;
}

export async function updateExperiment(input: UpdateExperimentInput) {
  const experiment = await prisma.experiment.findFirst({
    where: { id: input.experimentId, shopId: input.shopId },
    select: { id: true, campaignId: true },
  });

  if (!experiment) {
    throw new Error("Experiment not found.");
  }

  await prisma.experiment.update({
    where: { id: input.experimentId },
    data: {
      ...(input.name !== undefined
        ? { name: input.name.trim() || "Campaign experiment" }
        : {}),
      ...(input.trafficSplitStrategy !== undefined
        ? {
            trafficSplitStrategy:
              input.trafficSplitStrategy.trim() || "WEIGHTED",
          }
        : {}),
      ...(input.primaryMetric !== undefined
        ? { primaryMetric: normalizePrimaryMetric(input.primaryMetric) }
        : {}),
    },
  });

  for (const variant of input.variants ?? []) {
    if (variant.id) {
      await prisma.experimentVariant.updateMany({
        where: {
          id: variant.id,
          experimentId: input.experimentId,
          campaignId: experiment.campaignId,
        },
        data: toVariantUpdateInput(variant),
      });
    } else {
      await prisma.experimentVariant.create({
        data: {
          ...toVariantCreateInput(experiment.campaignId, variant),
          experiment: { connect: { id: input.experimentId } },
        },
      });
    }
  }

  await markCampaignSaved(experiment.campaignId, input.shopId);

  return getExperimentForShop(input.experimentId, input.shopId);
}

export async function archiveExperimentVariant({
  experimentId,
  shopId,
  variantId,
}: {
  experimentId: string;
  shopId: string;
  variantId: string;
}) {
  const experiment = await prisma.experiment.findFirst({
    where: { id: experimentId, shopId },
    include: experimentInclude,
  });

  if (!experiment) {
    throw new Error("Experiment not found.");
  }

  if (experiment.status === ExperimentStatus.COMPLETED) {
    throw new Error("Completed experiments cannot be edited.");
  }

  const activeVariants = experiment.variants.filter(
    (variant) => variant.status !== ExperimentVariantStatus.ARCHIVED,
  );
  const variantIndex = activeVariants.findIndex(
    (variant) => variant.id === variantId,
  );
  const variant = activeVariants[variantIndex];

  if (!variant) {
    throw new Error("Experiment variant not found.");
  }

  if (variantIndex === 0) {
    throw new Error("The control variant cannot be deleted.");
  }

  if (experiment.winnerVariantId === variantId) {
    throw new Error("The winning variant cannot be deleted.");
  }

  const remainingVariants = normalizeExperimentVariantWeights(
    activeVariants.filter((activeVariant) => activeVariant.id !== variantId),
  );

  await prisma.$transaction(async (tx) => {
    await tx.experimentVariant.update({
      where: { id: variantId },
      data: {
        status: ExperimentVariantStatus.ARCHIVED,
        weight: 0,
      },
    });

    for (const remainingVariant of remainingVariants) {
      await tx.experimentVariant.update({
        where: { id: remainingVariant.id },
        data: { weight: remainingVariant.weight },
      });
    }
  });

  await markCampaignSaved(experiment.campaignId, shopId);

  return getExperimentForShop(experimentId, shopId);
}

export async function updateExperimentAutoWinner({
  experimentId,
  shopId,
  settings,
}: {
  experimentId: string;
  shopId: string;
  settings: AutoWinnerSettingsInput;
}) {
  const experiment = await assertExperimentBelongsToShop(experimentId, shopId);

  const updatedExperiment = await prisma.experiment.update({
    where: { id: experimentId },
    data: {
      autoWinnerEnabled: settings.enabled ?? false,
      autoWinnerMinSampleSize: normalizeMinimumSampleSize(
        settings.minSampleSize,
      ),
      autoWinnerMinRuntimeHours: normalizeMinimumRuntimeHours(
        settings.minRuntimeHours,
      ),
      autoWinnerConfidenceThreshold: normalizeConfidenceThreshold(
        settings.confidenceThreshold,
      ),
    },
    include: experimentInclude,
  });

  await markCampaignSaved(experiment.campaignId, shopId);

  return updatedExperiment;
}

export async function startExperiment({
  experimentId,
  shopId,
  now = new Date(),
}: {
  experimentId: string;
  shopId: string;
  now?: Date;
}) {
  const experiment = await getExperimentForShop(experimentId, shopId);

  if (!experiment) {
    throw new Error("Experiment not found.");
  }

  const eligibleVariants = experiment.variants.filter(
    (variant) =>
      variant.status !== ExperimentVariantStatus.ARCHIVED &&
      Number(variant.weight) > 0,
  );

  if (eligibleVariants.length < 2) {
    throw new Error("An experiment needs at least two weighted variants.");
  }

  await prisma.experimentVariant.updateMany({
    where: {
      experimentId,
      status: {
        in: [ExperimentVariantStatus.DRAFT, ExperimentVariantStatus.PAUSED],
      },
    },
    data: { status: ExperimentVariantStatus.ACTIVE },
  });

  const updatedExperiment = await prisma.experiment.update({
    where: { id: experimentId },
    data: {
      status: ExperimentStatus.RUNNING,
      startsAt: experiment.startsAt ?? now,
      endsAt: null,
    },
    include: experimentInclude,
  });

  await markCampaignSaved(experiment.campaignId, shopId);

  return updatedExperiment;
}

export async function pauseExperiment({
  experimentId,
  shopId,
}: {
  experimentId: string;
  shopId: string;
}) {
  const experiment = await assertExperimentBelongsToShop(experimentId, shopId);

  await prisma.experimentVariant.updateMany({
    where: {
      experimentId,
      status: ExperimentVariantStatus.ACTIVE,
    },
    data: { status: ExperimentVariantStatus.PAUSED },
  });

  const updatedExperiment = await prisma.experiment.update({
    where: { id: experimentId },
    data: { status: ExperimentStatus.PAUSED },
    include: experimentInclude,
  });

  await markCampaignSaved(experiment.campaignId, shopId);

  return updatedExperiment;
}

export async function stopExperiment({
  experimentId,
  shopId,
  now = new Date(),
}: {
  experimentId: string;
  shopId: string;
  now?: Date;
}) {
  const experiment = await assertExperimentBelongsToShop(experimentId, shopId);

  const updatedExperiment = await prisma.experiment.update({
    where: { id: experimentId },
    data: {
      status: ExperimentStatus.COMPLETED,
      endsAt: now,
    },
    include: experimentInclude,
  });

  await markCampaignSaved(experiment.campaignId, shopId);

  return updatedExperiment;
}

export async function listExperimentsForCampaign(
  shopId: string,
  campaignId: string,
) {
  return prisma.experiment.findMany({
    where: { shopId, campaignId },
    include: experimentInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function calculateExperimentResults(
  input:
    | {
        shopId: string;
        experimentId: string;
        now?: Date;
      }
    | {
        experiment: ExperimentWithAutoWinner;
        touches: ExperimentTouchRecord[];
        conversions: ExperimentConversionRecord[];
        now?: Date;
      },
): Promise<ExperimentResults> {
  if ("experiment" in input) {
    return buildExperimentResults(
      input.experiment,
      input.touches,
      input.conversions,
      input.now ?? new Date(),
    );
  }

  const experiment = await prisma.experiment.findFirst({
    where: { id: input.experimentId, shopId: input.shopId },
    include: experimentInclude,
  });

  if (!experiment) {
    throw new Error("Experiment not found.");
  }

  const [touches, conversions] = await Promise.all([
    prisma.attributionTouch.findMany({
      where: {
        shopId: input.shopId,
        experimentId: input.experimentId,
      },
      select: {
        variantId: true,
        visitorId: true,
        sessionId: true,
        eventType: true,
      },
    }),
    prisma.attributionConversion.findMany({
      where: {
        shopId: input.shopId,
        experimentId: input.experimentId,
      },
      select: {
        variantId: true,
        visitorId: true,
        sessionId: true,
        orderId: true,
        revenueAmount: true,
        currencyCode: true,
      },
    }),
  ]);

  return buildExperimentResults(
    experiment as ExperimentWithAutoWinner,
    touches,
    conversions,
    input.now ?? new Date(),
  );
}

export function detectWinningVariant(
  results: ExperimentResults,
  settings: Partial<AutoWinnerSettingsInput> = {},
): WinningVariantDetection | null {
  const minSampleSize = normalizeMinimumSampleSize(
    settings.minSampleSize ?? results.autoWinner.minSampleSize,
  );
  const minRuntimeHours = normalizeMinimumRuntimeHours(
    settings.minRuntimeHours ?? results.autoWinner.minRuntimeHours,
  );
  const confidenceThreshold = normalizeConfidenceThreshold(
    settings.confidenceThreshold ?? results.autoWinner.confidenceThreshold,
  );

  if (results.runtimeHours < minRuntimeHours) return null;

  const eligibleVariants = results.variants
    .filter((variant) => variant.impressions >= minSampleSize)
    .sort((a, b) => b.primaryMetricValue - a.primaryMetricValue);

  if (eligibleVariants.length < 2) return null;

  const [winner, runnerUp] = eligibleVariants;

  if (!winner || !runnerUp || winner.primaryMetricValue <= 0) return null;
  if (winner.primaryMetricValue <= runnerUp.primaryMetricValue) return null;

  const relativeLift =
    (winner.primaryMetricValue - runnerUp.primaryMetricValue) /
    winner.primaryMetricValue;
  const confidenceScore = Math.min(0.99, 0.5 + relativeLift);

  if (confidenceScore < confidenceThreshold) return null;

  return {
    variantId: winner.variantId,
    confidenceScore,
    primaryMetricValue: winner.primaryMetricValue,
    runnerUpVariantId: runnerUp.variantId,
    runnerUpMetricValue: runnerUp.primaryMetricValue,
  };
}

export async function declareWinningVariant({
  experimentId,
  shopId,
  variantId,
  now = new Date(),
}: {
  experimentId: string;
  shopId: string;
  variantId: string;
  now?: Date;
}) {
  const variant = await prisma.experimentVariant.findFirst({
    where: {
      id: variantId,
      experimentId,
      experiment: { shopId },
    },
    select: { id: true },
  });

  if (!variant) {
    throw new Error("Experiment variant not found.");
  }

  const updatedExperiment = await prisma.$transaction(async (tx) => {
    await tx.experimentVariant.updateMany({
      where: {
        experimentId,
        id: { not: variantId },
        status: { not: ExperimentVariantStatus.ARCHIVED },
      },
      data: { status: ExperimentVariantStatus.LOSER },
    });
    await tx.experimentVariant.update({
      where: { id: variantId },
      data: { status: ExperimentVariantStatus.WINNER },
    });

    return tx.experiment.update({
      where: { id: experimentId },
      data: {
        status: ExperimentStatus.COMPLETED,
        endsAt: now,
        winnerVariantId: variantId,
        winnerDeclaredAt: now,
        winnerAppliedAt: null,
      },
      include: experimentInclude,
    });
  });

  await markCampaignSaved(updatedExperiment.campaignId, shopId);

  return updatedExperiment;
}

export async function autoDeclareWinningVariant({
  experimentId,
  shopId,
  now = new Date(),
}: {
  experimentId: string;
  shopId: string;
  now?: Date;
}) {
  const results = await calculateExperimentResults({
    shopId,
    experimentId,
    now,
  });
  const winner = detectWinningVariant(results);

  if (!winner) return { declared: false, results, winner: null };

  await declareWinningVariant({
    shopId,
    experimentId,
    variantId: winner.variantId,
    now,
  });

  return { declared: true, results, winner };
}

export async function applyWinningVariantToCampaign({
  experimentId,
  shopId,
  variantId,
  now = new Date(),
}: {
  experimentId: string;
  shopId: string;
  variantId?: string;
  now?: Date;
}) {
  const experiment = await prisma.experiment.findFirst({
    where: { id: experimentId, shopId },
    include: experimentInclude,
  });

  if (!experiment) {
    throw new Error("Experiment not found.");
  }

  const winningVariantId = variantId ?? experiment.winnerVariantId;

  if (!winningVariantId) {
    throw new Error("Declare a winning variant before applying it.");
  }

  const winningVariant = experiment.variants.find(
    (variant) => variant.id === winningVariantId,
  );

  if (!winningVariant) {
    throw new Error("Winning variant was not found.");
  }

  const updatedExperiment = await prisma.$transaction(async (tx) => {
    await applyTextOverride(tx, experiment.campaignId, winningVariant);
    await applyDesignOverride(tx, experiment.campaignId, winningVariant);
    await applyDiscountOverride(tx, experiment.campaignId, winningVariant);
    await applyPlacementOverride(tx, experiment.campaignId, winningVariant);

    await tx.experimentVariant.updateMany({
      where: {
        experimentId,
        id: { not: winningVariant.id },
        status: { not: ExperimentVariantStatus.ARCHIVED },
      },
      data: { status: ExperimentVariantStatus.LOSER },
    });
    await tx.experimentVariant.update({
      where: { id: winningVariant.id },
      data: { status: ExperimentVariantStatus.WINNER },
    });

    return tx.experiment.update({
      where: { id: experimentId },
      data: {
        status: ExperimentStatus.COMPLETED,
        endsAt: now,
        winnerVariantId: winningVariant.id,
        winnerDeclaredAt: experiment.winnerDeclaredAt ?? now,
        winnerAppliedAt: now,
      },
      include: experimentInclude,
    });
  });

  await markCampaignSaved(experiment.campaignId, shopId);

  return updatedExperiment;
}

export async function assignVariantToVisitor(
  input: AssignVariantInput,
): Promise<ExperimentVariant | null> {
  const experiment =
    "experiment" in input
      ? input.experiment
      : await prisma.experiment.findFirst({
          where: {
            id: input.experimentId,
            shopId: input.shopId,
            status: ExperimentStatus.RUNNING,
          },
          include: experimentInclude,
        });
  const now = input.now ?? new Date();

  if (!experiment || !input.visitorId) return null;
  if (!isExperimentRunning(experiment, now)) return null;

  return selectWeightedVariant(experiment, input.visitorId);
}

export function selectWeightedVariant(
  experiment: Pick<Experiment, "id" | "status" | "startsAt" | "endsAt"> & {
    variants: ExperimentVariant[];
  },
  visitorId: string,
) {
  if (!visitorId) return null;

  const variants = experiment.variants
    .filter(
      (variant) =>
        assignableVariantStatuses.has(variant.status) &&
        Number(variant.weight) > 0,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const totalWeight = variants.reduce(
    (total, variant) => total + Math.max(0, Math.trunc(variant.weight)),
    0,
  );

  if (variants.length === 0 || totalWeight <= 0) return null;

  const bucket =
    hashAssignmentBucket(`${experiment.id}:${visitorId}`) % totalWeight;
  let cumulativeWeight = 0;

  for (const variant of variants) {
    cumulativeWeight += Math.max(0, Math.trunc(variant.weight));
    if (bucket < cumulativeWeight) return variant;
  }

  return variants[variants.length - 1] ?? null;
}

export function hashAssignmentBucket(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

const experimentInclude = {
  variants: {
    orderBy: [{ createdAt: "asc" }],
  },
} satisfies Prisma.ExperimentInclude;

async function getExperimentForShop(experimentId: string, shopId: string) {
  return prisma.experiment.findFirst({
    where: { id: experimentId, shopId },
    include: experimentInclude,
  });
}

function normalizeExperimentVariantWeights<Variant extends { weight: number }>(
  variants: Variant[],
) {
  if (variants.length === 0) return variants;
  if (variants.length === 1) {
    return [{ ...variants[0], weight: 100 }];
  }

  const roundedWeights = variants.map((variant) =>
    Math.max(0, Math.round(variant.weight)),
  );
  const totalWeight = roundedWeights.reduce(
    (total, weight) => total + weight,
    0,
  );
  const sourceWeights =
    totalWeight > 0 ? roundedWeights : variants.map(() => 1);
  const normalizedWeights = distributeIntegerTotal(100, sourceWeights);

  return variants.map((variant, index) => ({
    ...variant,
    weight: normalizedWeights[index] ?? 0,
  }));
}

function distributeIntegerTotal(total: number, weights: number[]) {
  if (weights.length === 0) return [];

  const normalizedTotal = Math.max(0, Math.round(total));
  const weightSum = weights.reduce(
    (sum, weight) => sum + Math.max(0, weight),
    0,
  );

  if (weightSum <= 0) {
    const base = Math.floor(normalizedTotal / weights.length);
    let remainder = normalizedTotal - base * weights.length;

    return weights.map(() => {
      const value = base + (remainder > 0 ? 1 : 0);
      remainder -= 1;

      return value;
    });
  }

  const rawWeights = weights.map(
    (weight) => (Math.max(0, weight) / weightSum) * normalizedTotal,
  );
  const roundedWeights = rawWeights.map(Math.floor);
  let remainder =
    normalizedTotal -
    roundedWeights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  const sortedRemainders = rawWeights
    .map((weight, index) => ({
      index,
      remainder: weight - Math.floor(weight),
    }))
    .sort((left, right) => right.remainder - left.remainder);

  for (const item of sortedRemainders) {
    if (remainder <= 0) break;

    roundedWeights[item.index] += 1;
    remainder -= 1;
  }

  return roundedWeights;
}

async function assertCampaignBelongsToShop(campaignId: string, shopId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId },
    select: { id: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }
}

async function assertCampaignHasNoOpenExperiment(
  campaignId: string,
  shopId: string,
) {
  const experiment = await prisma.experiment.findFirst({
    where: {
      campaignId,
      shopId,
      status: { not: ExperimentStatus.COMPLETED },
    },
    select: { id: true },
  });

  if (experiment) {
    throw new Error("Finish the current experiment before creating another.");
  }
}

async function assertExperimentBelongsToShop(
  experimentId: string,
  shopId: string,
) {
  const experiment = await prisma.experiment.findFirst({
    where: { id: experimentId, shopId },
    select: { id: true, campaignId: true },
  });

  if (!experiment) {
    throw new Error("Experiment not found.");
  }

  return experiment;
}

function markCampaignSaved(campaignId: string, shopId: string) {
  return prisma.campaign.updateMany({
    where: { id: campaignId, shopId },
    data: { lastSavedAt: new Date() },
  });
}

function buildDuplicateExperimentName(name: string) {
  const baseName = name.trim() || "Campaign experiment";

  return `${baseName} copy`;
}

function isExperimentRunning(
  experiment: Pick<Experiment, "status" | "startsAt" | "endsAt">,
  now: Date,
) {
  return (
    experiment.status === ExperimentStatus.RUNNING &&
    (!experiment.startsAt || experiment.startsAt <= now) &&
    (!experiment.endsAt || experiment.endsAt >= now)
  );
}

function normalizePrimaryMetric(
  value: ExperimentPrimaryMetric | "CTR",
): ExperimentPrimaryMetric {
  if (value === "CTR" || value === "CLICK_RATE") {
    return ExperimentPrimaryMetric.CLICK_RATE;
  }

  return value;
}

function toVariantCreateInput(
  campaignId: string,
  variant: ExperimentVariantInput,
): Prisma.ExperimentVariantCreateWithoutExperimentInput {
  return {
    campaign: { connect: { id: campaignId } },
    name: variant.name.trim() || "Variant",
    weight: normalizeWeight(variant.weight),
    status: variant.status ?? ExperimentVariantStatus.DRAFT,
    designOverride: toNullableJsonInput(variant.designOverride),
    textOverride: toNullableJsonInput(variant.textOverride),
    discountOverride: toNullableJsonInput(variant.discountOverride),
    placementOverride: toNullableJsonInput(variant.placementOverride),
  };
}

function toVariantUpdateInput(
  variant: ExperimentVariantInput,
): Prisma.ExperimentVariantUpdateManyMutationInput {
  return {
    name: variant.name.trim() || "Variant",
    weight: normalizeWeight(variant.weight),
    ...(variant.status ? { status: variant.status } : {}),
    designOverride: toNullableJsonInput(variant.designOverride),
    textOverride: toNullableJsonInput(variant.textOverride),
    discountOverride: toNullableJsonInput(variant.discountOverride),
    placementOverride: toNullableJsonInput(variant.placementOverride),
  };
}

function normalizeWeight(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(10000, Math.trunc(value)));
}

function toNullableJsonInput(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;

  return value as Prisma.InputJsonValue;
}

function buildExperimentResults(
  experiment: ExperimentWithAutoWinner,
  touches: ExperimentTouchRecord[],
  conversions: ExperimentConversionRecord[],
  now: Date,
): ExperimentResults {
  const startedAt = experiment.startsAt ?? experiment.createdAt;
  const runtimeHours = Math.max(
    0,
    (now.getTime() - startedAt.getTime()) / 3_600_000,
  );
  const currencyCode =
    conversions.find((conversion) => conversion.currencyCode)?.currencyCode ??
    "USD";
  const variants = experiment.variants.map((variant) =>
    buildVariantResult(experiment.primaryMetric, variant, touches, conversions),
  );

  return {
    experimentId: experiment.id,
    campaignId: experiment.campaignId,
    status: experiment.status,
    primaryMetric: experiment.primaryMetric,
    winnerVariantId: experiment.winnerVariantId,
    runtimeHours,
    currencyCode,
    autoWinner: {
      enabled: experiment.autoWinnerEnabled,
      minSampleSize: experiment.autoWinnerMinSampleSize,
      minRuntimeHours: experiment.autoWinnerMinRuntimeHours,
      confidenceThreshold: experiment.autoWinnerConfidenceThreshold,
    },
    variants,
  };
}

function buildVariantResult(
  primaryMetric: ExperimentPrimaryMetric,
  variant: ExperimentVariant,
  touches: ExperimentTouchRecord[],
  conversions: ExperimentConversionRecord[],
): ExperimentVariantResult {
  const variantTouches = touches.filter(
    (touch) => touch.variantId === variant.id,
  );
  const variantConversions = conversions.filter(
    (conversion) => conversion.variantId === variant.id,
  );
  const visitors = new Set<string>();
  const orderIds = new Set<string>();
  let revenue = 0;

  for (const touch of variantTouches) {
    const visitorKey = getVisitorKey(touch.visitorId, touch.sessionId);
    if (visitorKey) visitors.add(visitorKey);
  }

  for (const conversion of variantConversions) {
    const visitorKey = getVisitorKey(
      conversion.visitorId,
      conversion.sessionId,
    );
    if (visitorKey) visitors.add(visitorKey);
    if (conversion.orderId) orderIds.add(conversion.orderId);
    revenue += readRevenue(conversion.revenueAmount);
  }

  const impressions = countEvents(
    variantTouches,
    AnalyticsEventType.IMPRESSION,
  );
  const clicks = countEvents(variantTouches, AnalyticsEventType.CLICK);
  const addToCart = countEvents(variantTouches, AnalyticsEventType.ADD_TO_CART);
  const checkoutStarted = countEvents(
    variantTouches,
    AnalyticsEventType.CHECKOUT_STARTED,
  );
  const visitorCount = visitors.size || impressions;
  const orders = orderIds.size || variantConversions.length;
  const ctr = safeRatio(clicks, impressions);
  const addToCartRate = safeRatio(addToCart, impressions);
  const checkoutRate = safeRatio(checkoutStarted, impressions);
  const revenuePerVisitor = safeRatio(revenue, visitorCount);
  const conversionRate = safeRatio(orders, visitorCount);

  return {
    variantId: variant.id,
    variantName: variant.name,
    status: variant.status,
    impressions,
    clicks,
    ctr,
    addToCart,
    addToCartRate,
    checkoutStarted,
    checkoutRate,
    orders,
    revenue,
    revenuePerVisitor,
    conversionRate,
    visitors: visitorCount,
    primaryMetricValue: readPrimaryMetricValue(primaryMetric, {
      ctr,
      addToCartRate,
      checkoutRate,
      revenuePerVisitor,
    }),
  };
}

function countEvents(
  touches: ExperimentTouchRecord[],
  eventType: AnalyticsEventType,
) {
  return touches.filter((touch) => touch.eventType === eventType).length;
}

function readPrimaryMetricValue(
  primaryMetric: ExperimentPrimaryMetric,
  values: Pick<
    ExperimentVariantResult,
    "ctr" | "addToCartRate" | "checkoutRate" | "revenuePerVisitor"
  >,
) {
  if (primaryMetric === ExperimentPrimaryMetric.ADD_TO_CART_RATE) {
    return values.addToCartRate;
  }
  if (primaryMetric === ExperimentPrimaryMetric.CHECKOUT_RATE) {
    return values.checkoutRate;
  }
  if (primaryMetric === ExperimentPrimaryMetric.REVENUE_PER_VISITOR) {
    return values.revenuePerVisitor;
  }

  return values.ctr;
}

function getVisitorKey(visitorId: string | null, sessionId: string | null) {
  return visitorId || (sessionId ? `session:${sessionId}` : "");
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function readRevenue(value: ExperimentConversionRecord["revenueAmount"]) {
  const parsedValue =
    typeof value === "number"
      ? value
      : value === null
        ? 0
        : Number(value.toString());

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function normalizeMinimumSampleSize(value: number | undefined) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) return 100;

  return Math.max(1, Math.trunc(parsedValue));
}

function normalizeMinimumRuntimeHours(value: number | undefined) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) return 24;

  return Math.max(0, Math.trunc(parsedValue));
}

function normalizeConfidenceThreshold(value: number | undefined) {
  if (!Number.isFinite(value)) return 0.95;

  return Math.max(0.5, Math.min(0.99, Number(value)));
}

type ExperimentTransaction = Prisma.TransactionClient;

async function applyTextOverride(
  tx: ExperimentTransaction,
  campaignId: string,
  variant: ExperimentVariant,
) {
  const override = jsonObject(variant.textOverride);
  const data = pickStringFields(override, [
    "headline",
    "subheadline",
    "ctaText",
    "ctaUrl",
    "expiredText",
    "freeShippingEmptyText",
    "freeShippingProgressText",
    "freeShippingSuccessText",
    "deliveryBeforeCutoffText",
    "deliveryAfterCutoffText",
    "lowStockText",
    "badgeText",
  ]);

  if (Object.keys(data).length === 0) return;

  await tx.campaignTranslation.upsert({
    where: {
      campaignId_locale: {
        campaignId,
        locale: "en",
      },
    },
    create: {
      campaignId,
      locale: "en",
      ...data,
    },
    update: data,
  });
}

async function applyDesignOverride(
  tx: ExperimentTransaction,
  campaignId: string,
  variant: ExperimentVariant,
) {
  const override = jsonObject(variant.designOverride);
  const alignment = readDesignAlignment(override.alignment);
  const backgroundType = readDesignBackgroundType(override.backgroundType);
  const entranceAnimation = readDesignBannerAnimation(
    override.entranceAnimation,
  );
  const exitAnimation = readDesignBannerAnimation(override.exitAnimation);
  const fontFamily = readDesignFontFamily(override.fontFamily);
  const icon = readCampaignDesignIcon(override.icon);
  const layout = readDesignLayout(override.layout);
  const positionMode = readDesignPositionMode(override.positionMode);
  const timerFormat = readDesignTimerFormat(override.timerFormat);
  const timerStyle = readDesignTimerStyle(override.timerStyle);
  const timerTickAnimation = readDesignTimerTickAnimation(
    override.timerTickAnimation,
  );
  const data: Omit<Prisma.CampaignDesignUncheckedCreateInput, "campaignId"> = {
    ...pickStringFields(override, [
      "templateKey",
      "backgroundColor",
      "backgroundImageUrl",
      "gradientStartColor",
      "gradientEndColor",
      "textColor",
      "accentColor",
      "buttonColor",
      "buttonTextColor",
      "closeButtonColor",
      "borderColor",
      "titleColor",
      "subheadingColor",
      "timerColor",
      "legendColor",
      "timerDaysLabel",
      "timerHoursLabel",
      "timerMinutesLabel",
      "timerSecondsLabel",
      "timerSurfaceColor",
      "timerSurfaceBorderColor",
      "customCss",
      "customIconUrl",
    ]),
    ...pickIntegerFields(override, [
      "gradientAngle",
      "fontSize",
      "borderRadius",
      "borderSize",
      "titleFontSize",
      "subheadingFontSize",
      "timerFontSize",
      "legendFontSize",
      "timerSurfaceBorderSize",
      "timerSurfaceRadius",
      "paddingBlock",
      "paddingInline",
      "contentGap",
      "contentMaxWidth",
      "animationDurationMs",
      "iconSize",
    ]),
    ...pickBooleanFields(override, [
      "fullWidth",
      "positionSticky",
      "mobileEnabled",
      "showCloseButton",
      "showButton",
      "showProgressBar",
      "showIcon",
      "timerShowLabels",
      "timerShowSeconds",
      "timerHideZeroDays",
    ]),
    ...(alignment ? { alignment } : {}),
    ...(backgroundType ? { backgroundType } : {}),
    ...(entranceAnimation ? { entranceAnimation } : {}),
    ...(exitAnimation ? { exitAnimation } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...(icon ? { icon } : {}),
    ...(layout ? { layout } : {}),
    ...(positionMode ? { positionMode } : {}),
    ...(timerFormat ? { timerFormat } : {}),
    ...(timerStyle ? { timerStyle } : {}),
    ...(timerTickAnimation ? { timerTickAnimation } : {}),
  };

  if (Object.keys(data).length === 0) return;

  await tx.campaignDesign.upsert({
    where: { campaignId },
    create: { campaignId, ...data },
    update: data,
  });
}

async function applyDiscountOverride(
  tx: ExperimentTransaction,
  campaignId: string,
  variant: ExperimentVariant,
) {
  const override = jsonObject(variant.discountOverride);
  const discountCode = readString(override.discountCode);
  const method =
    readDiscountSyncMethod(override.method) ??
    (discountCode ? DiscountSyncMethod.CODE : null);
  const valueType = readDiscountValueType(override.valueType);
  const value = readDecimal(override.value);
  const minimumSubtotal = readDecimal(override.minimumSubtotal);

  if (!method) return;

  const data: Omit<Prisma.DiscountSyncUncheckedCreateInput, "campaignId"> = {
    ...pickStringFields(override, ["shopifyDiscountId", "title"]),
    ...(discountCode ? { discountCode } : {}),
    method,
    ...(typeof override.syncStartEnd === "boolean"
      ? { syncStartEnd: override.syncStartEnd }
      : { syncStartEnd: false }),
    ...(valueType ? { valueType } : {}),
    ...(value !== null ? { value } : {}),
    ...(minimumSubtotal !== null ? { minimumSubtotal } : {}),
    ...(typeof override.appliesOncePerCustomer === "boolean"
      ? { appliesOncePerCustomer: override.appliesOncePerCustomer }
      : {}),
  };

  await tx.discountSync.upsert({
    where: { campaignId },
    create: {
      campaignId,
      ...data,
    },
    update: data,
  });
}

async function applyPlacementOverride(
  tx: ExperimentTransaction,
  campaignId: string,
  variant: ExperimentVariant,
) {
  const override = jsonObject(variant.placementOverride);
  const placementType =
    readPlacementType(override.placementType) ??
    readPlacementType(override.placement);
  const customSelector =
    readString(override.customSelector) ??
    readString(override.placementSelector);
  const data = {
    ...(placementType ? { placementType } : {}),
    ...(customSelector ? { customSelector } : {}),
  };

  if (Object.keys(data).length === 0) return;

  const updated = await tx.campaignPlacement.updateMany({
    where: { campaignId, enabled: true },
    data,
  });

  if (updated.count === 0 && placementType) {
    await tx.campaignPlacement.create({
      data: {
        campaignId,
        placementType,
        customSelector: customSelector ?? null,
        enabled: true,
      },
    });
  }
}

function pickStringFields(
  source: Record<string, unknown>,
  keys: string[],
): Record<string, string> {
  return keys.reduce<Record<string, string>>((data, key) => {
    const value = readString(source[key]);
    if (value !== null) data[key] = value;
    return data;
  }, {});
}

function pickIntegerFields(source: Record<string, unknown>, keys: string[]) {
  return keys.reduce<Record<string, number>>((data, key) => {
    const value = Number(source[key]);
    if (Number.isInteger(value)) data[key] = value;
    return data;
  }, {});
}

function pickBooleanFields(source: Record<string, unknown>, keys: string[]) {
  return keys.reduce<Record<string, boolean>>((data, key) => {
    if (typeof source[key] === "boolean") data[key] = source[key];
    return data;
  }, {});
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? new Prisma.Decimal(numberValue) : null;
}

function readDesignAlignment(value: unknown) {
  return Object.values(DesignAlignment).includes(value as DesignAlignment)
    ? (value as DesignAlignment)
    : null;
}

function readDesignBackgroundType(value: unknown) {
  return Object.values(DesignBackgroundType).includes(
    value as DesignBackgroundType,
  )
    ? (value as DesignBackgroundType)
    : null;
}

function readDesignBannerAnimation(value: unknown) {
  return Object.values(DesignBannerAnimation).includes(
    value as DesignBannerAnimation,
  )
    ? (value as DesignBannerAnimation)
    : null;
}

function readDesignFontFamily(value: unknown) {
  return Object.values(DesignFontFamily).includes(value as DesignFontFamily)
    ? (value as DesignFontFamily)
    : null;
}

function readDesignLayout(value: unknown) {
  return Object.values(DesignLayout).includes(value as DesignLayout)
    ? (value as DesignLayout)
    : null;
}

function readDesignPositionMode(value: unknown) {
  return Object.values(DesignPositionMode).includes(value as DesignPositionMode)
    ? (value as DesignPositionMode)
    : null;
}

function readDesignTimerFormat(value: unknown) {
  return Object.values(DesignTimerFormat).includes(value as DesignTimerFormat)
    ? (value as DesignTimerFormat)
    : null;
}

function readDesignTimerStyle(value: unknown) {
  return Object.values(DesignTimerStyle).includes(value as DesignTimerStyle)
    ? (value as DesignTimerStyle)
    : null;
}

function readDesignTimerTickAnimation(value: unknown) {
  return Object.values(DesignTimerTickAnimation).includes(
    value as DesignTimerTickAnimation,
  )
    ? (value as DesignTimerTickAnimation)
    : null;
}

function readCampaignDesignIcon(value: unknown) {
  return Object.values(CampaignDesignIcon).includes(value as CampaignDesignIcon)
    ? (value as CampaignDesignIcon)
    : null;
}

function readDiscountSyncMethod(value: unknown) {
  return value === "CODE" || value === "AUTOMATIC" || value === "UNIQUE_CODE"
    ? value
    : null;
}

function readDiscountValueType(value: unknown) {
  return Object.values(DiscountCodeValueType).includes(
    value as DiscountCodeValueType,
  )
    ? (value as DiscountCodeValueType)
    : null;
}

function readPlacementType(value: unknown) {
  return Object.values(PlacementType).includes(value as PlacementType)
    ? (value as PlacementType)
    : null;
}
