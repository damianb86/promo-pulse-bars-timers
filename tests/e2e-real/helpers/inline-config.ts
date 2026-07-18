import prisma from "../../../app/db.server";
import { publishStorefrontInlineConfig } from "../../../app/services/storefront-inline-config.server";
import { getConfig } from "./env";

/**
 * The storefront theme renders campaigns from the Shopify app metafield
 * `promo_pulse.storefront_payload` (see promo-pulse-embed.liquid ->
 * `window.PromoPulseCampaignConfigs`). That metafield is only refreshed when a
 * campaign is published/edited through the app UI (which holds an authenticated
 * admin session). Direct-DB fixtures bypass that path, so without this helper
 * the deployed storefront never reflects fixture campaigns even though the live
 * app-proxy API returns them.
 *
 * This rebuilds and pushes the inline-config metafield using the Admin API
 * token, mirroring what `syncStorefrontInlineConfig` does inside the app. It is
 * a no-op when no Admin API token is configured (e.g. the in-process local
 * suite, where the app and fixtures already share a database).
 */
export async function syncStorefrontInlineConfigForShopId(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, shopifyDomain: true, plan: true },
  });
  if (!shop) return;

  const accessToken = await resolveAdminAccessToken(shop.shopifyDomain);
  if (!accessToken) return;

  await publishStorefrontInlineConfig({
    admin: createAdminGraphqlShim(shop.shopifyDomain, accessToken),
    shop,
  });
}

/**
 * Prefer an explicit Admin API token; otherwise fall back to the Promo Pulse
 * app's stored offline session token. The offline session token is the one that
 * belongs to the Promo Pulse app, so `currentAppInstallation` resolves to the
 * app whose metafield the theme reads (`app.metafields.promo_pulse.*`).
 */
async function resolveAdminAccessToken(shopDomain: string) {
  const explicit = getConfig().adminAccessToken;
  if (explicit) return explicit;

  const session = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    select: { accessToken: true },
  });

  return session?.accessToken ?? "";
}

/**
 * Minimal `ShopifyGraphqlClient`-shaped shim backed by the Admin API token.
 * `publishStorefrontInlineConfig` only calls `admin.graphql(query, { variables })`
 * and then reads `response.ok` / `response.json()` - exactly the shape of a
 * native `fetch` Response, so we return it directly.
 */
function createAdminGraphqlShim(shopDomain: string, accessToken: string) {
  const endpoint = `https://${shopDomain}/admin/api/${getConfig().adminApiVersion}/graphql.json`;

  return {
    graphql: (
      query: string,
      options?: { variables?: Record<string, unknown> },
    ) =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query,
          variables: options?.variables ?? {},
        }),
      }),
  } as unknown as Parameters<typeof publishStorefrontInlineConfig>[0]["admin"];
}
