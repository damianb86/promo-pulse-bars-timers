import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const DEFAULT_SHOPIFY_API_VERSION = ApiVersion.October25;
const shopifyApiVersion = resolveShopifyApiVersion(
  process.env.SHOPIFY_API_VERSION,
);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: shopifyApiVersion,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = shopifyApiVersion;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

function resolveShopifyApiVersion(value?: string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) return DEFAULT_SHOPIFY_API_VERSION;

  const supportedVersion = (Object.values(ApiVersion) as string[]).find(
    (version) => version === normalizedValue,
  );

  if (supportedVersion) {
    return supportedVersion as ApiVersion;
  }

  console.warn(
    `Unsupported SHOPIFY_API_VERSION="${normalizedValue}". Falling back to ${DEFAULT_SHOPIFY_API_VERSION}.`,
  );
  return DEFAULT_SHOPIFY_API_VERSION;
}
