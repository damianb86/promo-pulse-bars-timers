import {
  EmailTimerExpiredBehavior,
  EmailTimerMode,
  Prisma,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

import prisma from "../../db.server";

export type CreateEmailTimerInput = {
  shopId: string;
  campaignId: string;
  width: number;
  height: number;
  expiredBehavior: EmailTimerExpiredBehavior;
};

export type EmailTimerListItem = Awaited<
  ReturnType<typeof listEmailTimersForCampaign>
>[number];

export async function createEmailTimerForCampaign({
  shopId,
  campaignId,
  width,
  height,
  expiredBehavior,
}: CreateEmailTimerInput) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (!campaign.endsAt) {
    throw new Error("Email timers require a real campaign end date.");
  }

  const design = {
    width,
    height,
  } satisfies Prisma.InputJsonObject;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.emailTimer.create({
        data: {
          shopId,
          campaignId,
          publicToken: generateEmailTimerPublicToken(),
          mode: EmailTimerMode.FIXED_DATE,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          timezone: campaign.timezone,
          expiredBehavior,
          design,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Email timer token could not be generated.");
}

export function listEmailTimersForCampaign(shopId: string, campaignId: string) {
  return prisma.emailTimer.findMany({
    where: { shopId, campaignId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function findEmailTimerForRender(publicToken: string) {
  return prisma.emailTimer.findUnique({
    where: { publicToken },
    include: {
      campaign: {
        include: {
          design: true,
          translations: true,
        },
      },
    },
  });
}

export function buildEmailTimerImageUrl(request: Request, publicToken: string) {
  const appBaseUrl =
    process.env.SHOPIFY_APP_URL?.trim().replace(/\/+$/, "") ||
    new URL(request.url).origin;

  return `${appBaseUrl}/api/email-timer/${encodeURIComponent(
    publicToken,
  )}.png`;
}

export function buildEmailTimerSnippet(imageUrl: string, width: number) {
  return `<img src="${imageUrl}" alt="Offer countdown timer" width="${width}" style="display:block;border:0;max-width:100%;height:auto;" />`;
}

export function generateEmailTimerPublicToken() {
  return randomBytes(24).toString("base64url");
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
