import { describe, expect, it } from "vitest";

import { getMarketContext, normalizeMarket } from "./markets.server";

describe("Shopify Markets service helpers", () => {
  it("normalizes Shopify market nodes from Admin API", () => {
    expect(
      normalizeMarket({
        id: "gid://shopify/Market/1",
        name: "Spain",
        handle: "es",
        enabled: true,
        primary: false,
        regions: {
          nodes: [{ code: "es" }, { code: "pt" }],
        },
        webPresence: {
          defaultLocale: { locale: "es_ES" },
        },
        currencySettings: {
          baseCurrency: { currencyCode: "eur" },
        },
      }),
    ).toEqual({
      id: "gid://shopify/Market/1",
      name: "Spain",
      handle: "ES",
      enabled: true,
      primary: false,
      countryCodes: ["ES", "PT"],
      locale: "es-es",
      currencyCode: "EUR",
    });
  });

  it("normalizes storefront market context without PII", () => {
    expect(
      getMarketContext({
        market: "es",
        country: "es",
        locale: "es_ES",
        currency: "eur",
      }),
    ).toEqual({
      marketId: "ES",
      countryCode: "ES",
      locale: "es-es",
      currencyCode: "EUR",
    });
  });
});
