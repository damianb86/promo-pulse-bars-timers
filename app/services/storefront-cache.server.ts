import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Shop } from "@prisma/client";

import prisma from "../db.server";
import type {
  PublicShopSettings,
  ShopSettingsValues,
} from "./shopSettings.server";
import type {
  StorefrontCampaignContext,
  StorefrontCampaignResponseItem,
  StorefrontCampaignSource,
} from "../utils/storefront-campaigns";

type StorefrontSnapshot = {
  shop: Shop;
  settings: ShopSettingsValues;
  publicSettings: PublicShopSettings;
  campaigns: StorefrontCampaignSource[];
  version: string;
  createdAt: string;
  expiresAt: string;
};

type StorefrontPayloadBody = {
  campaigns?: StorefrontCampaignResponseItem[];
  // Index of campaign IDs by placement; full campaign data lives in `campaigns`.
  placements?: Record<string, string[]>;
  settings?: Partial<PublicShopSettings>;
  badges?: true;
};

type StorefrontPayloadEntry = {
  body: StorefrontPayloadBody;
  etag: string;
  version: string;
  createdAt: string;
  expiresAt: string;
  clientExpiresAt: string;
};

type SnapshotLoader = () => Promise<{
  shop: Shop | null;
  settings: ShopSettingsValues | null;
  publicSettings: PublicShopSettings | null;
  campaigns: StorefrontCampaignSource[];
}>;

const snapshotMemory = new Map<string, StorefrontSnapshot>();
const payloadMemory = new Map<string, StorefrontPayloadEntry>();
const impressionGateMemory = new Map<
  string,
  { reached: boolean; expiresAt: number }
>();
const shopIdToDomain = new Map<string, string>();
const cacheDir =
  process.env.STOREFRONT_CACHE_DIR ||
  path.join(process.cwd(), ".cache", "storefront");
const fileCacheEnabled =
  process.env.NODE_ENV !== "test" &&
  process.env.STOREFRONT_FILE_CACHE_ENABLED !== "false";
const snapshotTtlMs = readPositiveIntegerEnv(
  "STOREFRONT_SNAPSHOT_CACHE_TTL_MS",
  6 * 60 * 60 * 1000,
);
const payloadTtlMs = readPositiveIntegerEnv(
  "STOREFRONT_PAYLOAD_CACHE_TTL_MS",
  60 * 60 * 1000,
);
const clientCacheTtlMs = readPositiveIntegerEnv(
  "STOREFRONT_CLIENT_CACHE_TTL_MS",
  5 * 60 * 1000,
);
const maxPayloadEntries = readPositiveIntegerEnv(
  "STOREFRONT_PAYLOAD_CACHE_MAX_ENTRIES",
  500,
);
const impressionGateTtlMs = readPositiveIntegerEnv(
  "STOREFRONT_IMPRESSION_GATE_CACHE_TTL_MS",
  60_000,
);

export async function getCachedStorefrontSnapshot(
  shopDomain: string,
  loader: SnapshotLoader,
  now = Date.now(),
) {
  const key = normalizeCacheKey(shopDomain);
  const memoryEntry = snapshotMemory.get(key);

  if (memoryEntry && Date.parse(memoryEntry.expiresAt) > now) {
    return memoryEntry;
  }

  const fileEntry = await readSnapshotFile(key, now);

  if (fileEntry) {
    rememberSnapshot(key, fileEntry);
    return fileEntry;
  }

  const loaded = await loader();

  if (!loaded.shop || !loaded.settings || !loaded.publicSettings) {
    return null;
  }

  const snapshot = buildSnapshot(loaded, now);

  rememberSnapshot(key, snapshot);
  void writeSnapshotFile(key, snapshot);

  return snapshot;
}

export async function invalidateStorefrontCacheForShopId(shopId: string) {
  impressionGateMemory.delete(shopId);

  const shopDomains = new Set<string>();
  const cachedShopDomain = shopIdToDomain.get(shopId);

  if (cachedShopDomain) {
    shopDomains.add(cachedShopDomain);
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { shopifyDomain: true },
  });

  if (shop?.shopifyDomain) {
    shopDomains.add(shop.shopifyDomain);
  }

  if (shopDomains.size > 0) {
    await Promise.all(
      Array.from(shopDomains).map((shopDomain) =>
        invalidateStorefrontCacheForShop(shopDomain),
      ),
    );
    return;
  }

  snapshotMemory.clear();
  payloadMemory.clear();
  shopIdToDomain.clear();

  if (fileCacheEnabled) {
    await rm(cacheDir, { recursive: true, force: true });
  }
}

export async function getCachedStorefrontImpressionGate(
  shopId: string,
  loader: () => Promise<boolean>,
  now = Date.now(),
) {
  const cached = impressionGateMemory.get(shopId);

  if (cached && cached.expiresAt > now) {
    return cached.reached;
  }

  const reached = await loader();

  impressionGateMemory.set(shopId, {
    reached,
    expiresAt: now + impressionGateTtlMs,
  });

  return reached;
}

export async function invalidateStorefrontCacheForShop(shopDomain: string) {
  const key = normalizeCacheKey(shopDomain);

  snapshotMemory.delete(key);
  for (const payloadKey of payloadMemory.keys()) {
    if (payloadKey.startsWith(`${key}:`)) {
      payloadMemory.delete(payloadKey);
    }
  }

  if (!fileCacheEnabled) return;

  await Promise.allSettled([
    rm(snapshotFilePath(key), { force: true }),
    rm(payloadShopDir(key), { recursive: true, force: true }),
  ]);
}

export function clearStorefrontCacheForTests() {
  snapshotMemory.clear();
  payloadMemory.clear();
  impressionGateMemory.clear();
  shopIdToDomain.clear();
}

export function getCachedStorefrontPayload(cacheKey: string, now = Date.now()) {
  const memoryEntry = payloadMemory.get(cacheKey);

  if (memoryEntry && Date.parse(memoryEntry.expiresAt) > now) {
    return memoryEntry;
  }

  return null;
}

export async function getCachedStorefrontPayloadFromFile(
  cacheKey: string,
  now = Date.now(),
) {
  if (!fileCacheEnabled) return null;

  const fileEntry = await readPayloadFile(cacheKey, now);

  if (fileEntry) {
    rememberPayload(cacheKey, fileEntry);
  }

  return fileEntry;
}

export function setCachedStorefrontPayload(
  cacheKey: string,
  entry: StorefrontPayloadEntry,
) {
  rememberPayload(cacheKey, entry);
  void writePayloadFile(cacheKey, entry);
}

export function buildStorefrontPayloadCacheKey({
  context,
  snapshotVersion,
  visitorScoped = false,
}: {
  context: StorefrontCampaignContext;
  snapshotVersion: string;
  visitorScoped?: boolean;
}) {
  const shopKey = normalizeCacheKey(context.shop);
  const payloadKey = stableHash({
    snapshotVersion,
    path: context.path,
    locale: context.locale,
    country: context.country,
    market: context.market,
    productId: context.productId,
    collectionIds: context.collectionIds,
    productTags: context.productTags,
    customerTags: context.customerTags,
    device: context.device,
    currency: context.currency,
    placement: context.placement,
    placements: context.placements,
    visitorId: visitorScoped ? context.visitorId : "",
  });

  return `${shopKey}:${payloadKey}`;
}

export function buildStorefrontPayloadEntry({
  activeSignature,
  body,
  cacheKey,
  nextBoundaryAt,
  now = Date.now(),
  snapshotVersion,
}: {
  activeSignature: string;
  body: StorefrontPayloadBody;
  cacheKey: string;
  nextBoundaryAt: Date | null;
  now?: number;
  snapshotVersion: string;
}): StorefrontPayloadEntry {
  const expiresAt = Math.min(
    now + payloadTtlMs,
    nextBoundaryAt ? nextBoundaryAt.getTime() + 1000 : Number.MAX_SAFE_INTEGER,
  );
  const clientExpiresAt = Math.min(expiresAt, now + clientCacheTtlMs);
  const etag = quoteEtag(
    stableHash({
      activeSignature,
      cacheKey,
      snapshotVersion,
      expiresAt: nextBoundaryAt ? nextBoundaryAt.toISOString() : "",
    }),
  );

  return {
    body,
    etag,
    version: snapshotVersion,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    clientExpiresAt: new Date(clientExpiresAt).toISOString(),
  };
}

export function storefrontCacheHeaders(entry: StorefrontPayloadEntry) {
  const clientMaxAgeSeconds = Math.max(
    0,
    Math.floor((Date.parse(entry.clientExpiresAt) - Date.now()) / 1000),
  );

  return {
    ETag: entry.etag,
    "X-Promo-Pulse-Storefront-Version": entry.version,
    "X-Promo-Pulse-Cache-Expires-At": entry.clientExpiresAt,
    "X-Promo-Pulse-Client-Cache-Max-Age": String(clientMaxAgeSeconds),
  };
}

export function requestMatchesStorefrontEtag(
  request: Request,
  entry: StorefrontPayloadEntry,
) {
  const header = request.headers.get("if-none-match");

  if (!header) return false;

  return header
    .split(",")
    .map((value) => value.trim())
    .includes(entry.etag);
}

export function nextStorefrontCampaignBoundary(
  campaigns: StorefrontCampaignSource[],
  now = new Date(),
) {
  const nowMs = now.getTime();
  const boundaries = campaigns
    .flatMap((campaign) => [
      campaign.startsAt,
      campaign.endsAt,
      ...campaign.experiments.flatMap((experiment) => [
        experiment.startsAt,
        experiment.endsAt,
      ]),
    ])
    .map((value) => readDate(value))
    .filter((value): value is Date => Boolean(value))
    .filter((value) => value.getTime() > nowMs)
    .sort((first, second) => first.getTime() - second.getTime());

  return boundaries[0] ?? null;
}

export function storefrontActiveSignature(
  campaigns: StorefrontCampaignSource[],
) {
  return stableHash(
    campaigns.map((campaign) => ({
      id: campaign.id,
      publishedAt: campaign.publishedAt,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      placements: campaign.placements.map((placement) => ({
        placementType: placement.placementType,
        enabled: placement.enabled,
      })),
      experiments: campaign.experiments.map((experiment) => ({
        id: experiment.id,
        status: experiment.status,
        startsAt: experiment.startsAt,
        endsAt: experiment.endsAt,
        updatedAt: experiment.updatedAt,
        variants: experiment.variants.map((variant) => ({
          id: variant.id,
          status: variant.status,
          weight: variant.weight,
          updatedAt: variant.updatedAt,
        })),
      })),
    })),
  );
}

function buildSnapshot(
  loaded: Awaited<ReturnType<SnapshotLoader>>,
  now: number,
): StorefrontSnapshot {
  const snapshotBase = {
    shop: loaded.shop!,
    settings: loaded.settings!,
    publicSettings: loaded.publicSettings!,
    campaigns: loaded.campaigns,
  };
  const version = stableHash(snapshotBase);

  return {
    ...snapshotBase,
    version,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + snapshotTtlMs).toISOString(),
  };
}

function rememberSnapshot(key: string, snapshot: StorefrontSnapshot) {
  snapshotMemory.set(key, snapshot);
  shopIdToDomain.set(snapshot.shop.id, snapshot.shop.shopifyDomain);
}

function rememberPayload(key: string, payload: StorefrontPayloadEntry) {
  payloadMemory.set(key, payload);

  if (payloadMemory.size <= maxPayloadEntries) return;

  const firstKey = payloadMemory.keys().next().value as string | undefined;

  if (firstKey) {
    payloadMemory.delete(firstKey);
  }
}

async function readSnapshotFile(key: string, now: number) {
  if (!fileCacheEnabled) return null;

  try {
    const parsed = JSON.parse(
      await readFile(snapshotFilePath(key), "utf8"),
    ) as StorefrontSnapshot;
    const snapshot = reviveDates(parsed) as StorefrontSnapshot;

    return Date.parse(snapshot.expiresAt) > now ? snapshot : null;
  } catch {
    return null;
  }
}

async function writeSnapshotFile(key: string, snapshot: StorefrontSnapshot) {
  if (!fileCacheEnabled) return;

  try {
    await mkdir(path.dirname(snapshotFilePath(key)), { recursive: true });
    await writeFile(snapshotFilePath(key), JSON.stringify(snapshot), "utf8");
  } catch {
    return;
  }
}

async function readPayloadFile(key: string, now: number) {
  try {
    const parsed = JSON.parse(
      await readFile(payloadFilePath(key), "utf8"),
    ) as StorefrontPayloadEntry;

    return Date.parse(parsed.expiresAt) > now ? parsed : null;
  } catch {
    return null;
  }
}

async function writePayloadFile(key: string, payload: StorefrontPayloadEntry) {
  if (!fileCacheEnabled) return;

  try {
    await mkdir(path.dirname(payloadFilePath(key)), { recursive: true });
    await writeFile(payloadFilePath(key), JSON.stringify(payload), "utf8");
  } catch {
    return;
  }
}

function snapshotFilePath(key: string) {
  return path.join(cacheDir, "shops", `${safeFileName(key)}.json`);
}

function payloadShopDir(key: string) {
  return path.join(cacheDir, "payloads", safeFileName(key));
}

function payloadFilePath(key: string) {
  const [shopKey, payloadKey] = key.split(":");

  return path.join(payloadShopDir(shopKey), `${safeFileName(payloadKey)}.json`);
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeCacheKey(value: string) {
  return value.trim().toLowerCase();
}

function quoteEtag(value: string) {
  return `"pp-${value}"`;
}

function stableHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeForHash(value)))
    .digest("hex")
    .slice(0, 32);
}

function normalizeForHash(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = normalizeForHash((value as Record<string, unknown>)[key]);
      return output;
    }, {});
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (!value || typeof value !== "object") return value;

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((output, [key, nestedValue]) => {
    if (key.endsWith("At") && typeof nestedValue === "string") {
      output[key] = readDate(nestedValue) ?? nestedValue;
      return output;
    }

    output[key] = reviveDates(nestedValue);
    return output;
  }, {});
}

function readDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
