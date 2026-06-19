import { AnalyticsEventType } from "@prisma/client";

import prisma from "../../db.server";
import { renderEmailTimerPng } from "./emailTimerImage.server";
import { findEmailTimerForRender } from "./emailTimers.server";

export async function loadEmailTimerImageResponse(
  rawPublicToken: string | undefined,
  now = new Date(),
  request?: Request,
) {
  const publicToken = readPngToken(rawPublicToken);

  if (!publicToken) {
    return notFoundResponse();
  }

  const timer = await findEmailTimerForRender(publicToken);

  if (!timer) {
    return notFoundResponse();
  }

  recordEmailTimerView(timer, now, request).catch((error) => {
    console.error("Failed to record email timer view", error);
  });

  const image = renderEmailTimerPng(timer, now);

  return new Response(new Uint8Array(image.body), {
    status: 200,
    headers: imageHeaders(),
  });
}

async function recordEmailTimerView(
  timer: NonNullable<Awaited<ReturnType<typeof findEmailTimerForRender>>>,
  now: Date,
  request?: Request,
) {
  const path = request ? new URL(request.url).pathname : null;
  const userAgent = request?.headers.get("user-agent")?.slice(0, 500) ?? null;

  await prisma.analyticsEvent.create({
    data: {
      shopId: timer.shopId,
      campaignId: timer.campaignId,
      eventType: AnalyticsEventType.IMPRESSION,
      placementType: null,
      path,
      userAgent,
      occurredAt: now,
    },
  });
}

export function readPngToken(rawPublicToken: string | undefined) {
  const value = rawPublicToken?.trim() ?? "";

  if (!value.endsWith(".png")) return "";

  const token = value.slice(0, -4);

  return /^[A-Za-z0-9_-]{16,128}$/.test(token) ? token : "";
}

function notFoundResponse() {
  return new Response("Email timer was not found.", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function imageHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
    "Content-Type": "image/png",
    Expires: "0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}
