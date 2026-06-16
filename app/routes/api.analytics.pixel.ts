import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { mapWebPixelEventToAnalyticsPayload } from "../lib/web-pixel-events";
import {
  AnalyticsIngestionError,
  recordAnalyticsEvent,
  validateAnalyticsEventPayload,
} from "../models/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return pixelJsonResponse(null, { status: 204 });
  }

  return pixelJsonResponse(
    { error: "Use POST to record pixel analytics events." },
    { status: 405 },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return pixelJsonResponse(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return pixelJsonResponse(
      { error: "Use POST to record pixel analytics events." },
      { status: 405 },
    );
  }

  const body = await readJsonBody(request);
  const mappedEvent = mapWebPixelEventToAnalyticsPayload({
    ...body,
    userAgent: body.userAgent ?? request.headers.get("user-agent") ?? undefined,
  });

  if (!mappedEvent.ok) {
    return pixelJsonResponse(
      {
        ok: true,
        saved: false,
        ignored: true,
        reason: mappedEvent.reason,
        errors: mappedEvent.errors,
      },
      { status: mappedEvent.reason === "invalid_payload" ? 400 : 202 },
    );
  }

  const validation = validateAnalyticsEventPayload(mappedEvent.payload);

  if (!validation.ok) {
    return pixelJsonResponse(
      { error: "Invalid mapped analytics event.", details: validation.errors },
      { status: 400 },
    );
  }

  try {
    const result = await recordAnalyticsEvent(validation.payload);

    return pixelJsonResponse(
      {
        ok: true,
        saved: result.saved,
        deduped: result.deduped,
        ignored: result.ignored ?? false,
        reason: result.reason,
        eventId: result.eventId,
      },
      { status: result.saved ? 201 : 202 },
    );
  } catch (error) {
    if (error instanceof AnalyticsIngestionError) {
      return pixelJsonResponse(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to record Promo Pulse pixel analytics event", error);

    return pixelJsonResponse(
      { error: "Pixel analytics event could not be recorded." },
      { status: 500 },
    );
  }
};

async function readJsonBody(request: Request) {
  try {
    const body = await request.json();

    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function pixelJsonResponse(body: unknown, options: { status: number }) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });

  if (body !== null) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(body === null ? null : JSON.stringify(body), {
    status: options.status,
    headers,
  });
}
