import {
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
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

export type ExperimentWithVariants = Experiment & {
  variants: ExperimentVariant[];
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

  return prisma.experiment.create({
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

  return getExperimentForShop(input.experimentId, input.shopId);
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

  return prisma.experiment.update({
    where: { id: experimentId },
    data: {
      status: ExperimentStatus.RUNNING,
      startsAt: experiment.startsAt ?? now,
      endsAt: null,
    },
    include: experimentInclude,
  });
}

export async function pauseExperiment({
  experimentId,
  shopId,
}: {
  experimentId: string;
  shopId: string;
}) {
  await assertExperimentBelongsToShop(experimentId, shopId);

  await prisma.experimentVariant.updateMany({
    where: {
      experimentId,
      status: ExperimentVariantStatus.ACTIVE,
    },
    data: { status: ExperimentVariantStatus.PAUSED },
  });

  return prisma.experiment.update({
    where: { id: experimentId },
    data: { status: ExperimentStatus.PAUSED },
    include: experimentInclude,
  });
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
  await assertExperimentBelongsToShop(experimentId, shopId);

  return prisma.experiment.update({
    where: { id: experimentId },
    data: {
      status: ExperimentStatus.COMPLETED,
      endsAt: now,
    },
    include: experimentInclude,
  });
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

async function assertCampaignBelongsToShop(campaignId: string, shopId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId },
    select: { id: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }
}

async function assertExperimentBelongsToShop(
  experimentId: string,
  shopId: string,
) {
  const experiment = await prisma.experiment.findFirst({
    where: { id: experimentId, shopId },
    select: { id: true },
  });

  if (!experiment) {
    throw new Error("Experiment not found.");
  }
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
