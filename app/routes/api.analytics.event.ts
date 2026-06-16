import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AnalyticsIngestionError,
  recordAnalyticsEvent,
  validateAnalyticsEventPayload,
} from "../models/analytics.server";

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
  const validation = validateAnalyticsEventPayload({
    ...body,
    userAgent: body.userAgent ?? request.headers.get("user-agent") ?? undefined,
  });

  if (!validation.ok) {
    return analyticsJsonResponse(
      { error: "Invalid analytics event.", details: validation.errors },
      { status: 400 },
    );
  }

  try {
    const result = await recordAnalyticsEvent(validation.payload);

    return analyticsJsonResponse(
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
      return analyticsJsonResponse(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to record Promo Pulse analytics event", error);

    return analyticsJsonResponse(
      { error: "Analytics event could not be recorded." },
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

function analyticsJsonResponse(body: unknown, options: { status: number }) {
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
