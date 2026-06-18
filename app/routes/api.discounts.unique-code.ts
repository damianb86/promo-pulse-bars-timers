import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { unauthenticated } from "../shopify.server";
import { isE2ETestMode } from "../services/e2e-test.server";
import {
  issueUniqueDiscountCode,
  UniqueDiscountCodeError,
  type CreateRemoteUniqueDiscountInput,
} from "../services/unique-discount-codes.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return uniqueCodeJsonResponse(null, { status: 204 });
  }

  return uniqueCodeJsonResponse(
    { error: "Use POST to issue a unique discount code." },
    { status: 405 },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return uniqueCodeJsonResponse(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return uniqueCodeJsonResponse(
      { error: "Use POST to issue a unique discount code." },
      { status: 405 },
    );
  }

  const body = await readJsonBody(request);
  const shopDomain = readString(body.shop);

  try {
    const admin = await getAdminClient(shopDomain);
    const result = await issueUniqueDiscountCode({
      shopDomain,
      campaignId: readString(body.campaignId),
      visitorId: readString(body.visitorId),
      cartToken: readOptionalString(body.cartToken),
      admin,
      createRemoteDiscount: isE2ETestMode()
        ? createE2ERemoteDiscount
        : undefined,
    });

    return uniqueCodeJsonResponse({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof UniqueDiscountCodeError) {
      return uniqueCodeJsonResponse(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to issue unique discount code", error);

    return uniqueCodeJsonResponse(
      { error: "Unique discount code could not be issued." },
      { status: 500 },
    );
  }
};

async function getAdminClient(shopDomain: string) {
  if (!shopDomain || isE2ETestMode()) return null;

  const { admin } = await unauthenticated.admin(shopDomain);

  return admin;
}

async function createE2ERemoteDiscount({
  code,
}: CreateRemoteUniqueDiscountInput) {
  return { id: `e2e://${code}` };
}

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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const parsedValue = readString(value);

  return parsedValue || null;
}

function uniqueCodeJsonResponse(
  body: unknown,
  options: {
    status: number;
  },
) {
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
