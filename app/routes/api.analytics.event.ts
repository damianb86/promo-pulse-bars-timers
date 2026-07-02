import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AnalyticsIngestionError,
  recordAnalyticsEvent,
  validateAnalyticsEventPayload,
} from "../models/analytics.server";
import {
  buildCorsHeaders,
  verifyStorefrontAccess,
} from "../services/storefront-security.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return analyticsJsonResponse(null, { status: 204 });
  }

  return analyticsJsonResponse(
    { error: "Use POST to record analytics events." },
    { status: 405 },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return analyticsJsonResponse(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return analyticsJsonResponse(
      { error: "Use POST to record analytics events." },
      { status: 405 },
    );
  }

  const body = await readJsonBody(request);
  const isBatch = Array.isArray((body as { events?: unknown }).events);
  const rawEvents = isBatch
    ? ((body as { events: unknown[] }).events ?? [])
    : [body];

  if (rawEvents.length === 0 || rawEvents.length > MAX_ANALYTICS_BATCH_SIZE) {
    return analyticsJsonResponse(
      {
        error: `Send between 1 and ${MAX_ANALYTICS_BATCH_SIZE} analytics events per request.`,
      },
      { status: 400 },
    );
  }

  const validations = rawEvents.map((event) => {
    const eventObject = readEventObject(event);

    return validateAnalyticsEventPayload({
      shop: body.shop,
      doNotTrack: body.doNotTrack,
      consentGranted: body.consentGranted,
      ...eventObject,
      userAgent:
        eventObject.userAgent ??
        body.userAgent ??
        request.headers.get("user-agent") ??
        undefined,
    });
  });
  const validPayloads = validations.flatMap((validation) =>
    validation.ok ? [validation.payload] : [],
  );

  if (validPayloads.length === 0) {
    const firstError = validations.find((validation) => !validation.ok);

    return analyticsJsonResponse(
      {
        error: "Invalid analytics event.",
        details: firstError && !firstError.ok ? firstError.errors : undefined,
      },
      { status: 400 },
    );
  }

  const access = verifyStorefrontAccess(request, validPayloads[0].shop);

  if (!access.ok) {
    return analyticsJsonResponse(
      { error: access.error },
      { status: access.status, access },
    );
  }

  try {
    const results = await Promise.all(
      validPayloads.map((payload) => recordAnalyticsEvent(payload)),
    );

    if (!isBatch) {
      const result = results[0];

      return analyticsJsonResponse(
        {
          ok: true,
          saved: result.saved,
          deduped: result.deduped,
          ignored: result.ignored ?? false,
          reason: result.reason,
          eventId: result.eventId,
        },
        { status: result.saved ? 201 : 202, access },
      );
    }

    const savedCount = results.filter((result) => result.saved).length;

    return analyticsJsonResponse(
      {
        ok: true,
        received: rawEvents.length,
        processed: results.length,
        saved: savedCount,
        deduped: results.filter((result) => result.deduped).length,
      },
      { status: savedCount > 0 ? 201 : 202, access },
    );
  } catch (error) {
    if (error instanceof AnalyticsIngestionError) {
      return analyticsJsonResponse(
        { error: error.message },
        { status: error.status, access },
      );
    }

    console.error("Failed to record Promo Pulse analytics event", error);

    return analyticsJsonResponse(
      { error: "Analytics event could not be recorded." },
      { status: 500, access },
    );
  }
};

const MAX_ANALYTICS_BATCH_SIZE = 50;

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

function readEventObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function analyticsJsonResponse(
  body: unknown,
  options: {
    status: number;
    access?: ReturnType<typeof verifyStorefrontAccess>;
  },
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...buildCorsHeaders(options.access),
  });

  if (body !== null) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(body === null ? null : JSON.stringify(body), {
    status: options.status,
    headers,
  });
}
