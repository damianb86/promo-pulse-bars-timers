import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { describe, expect, it, vi } from "vitest";

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../theme-extension-src/promo-pulse-theme/discount-code.js",
);
const source = readFileSync(sourcePath, "utf8");

describe("storefront visitor and session tracking", () => {
  it("keeps visitorId and sessionId stable in the current session", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    const context = loadDiscountCodeScript({ localStorage, sessionStorage });

    trackCampaign(context, "IMPRESSION");
    trackCampaign(context, "CLICK");

    const [firstPayload, secondPayload] = readFetchPayloads(context);

    expect(secondPayload.visitorId).toBe(firstPayload.visitorId);
    expect(secondPayload.sessionId).toBe(firstPayload.sessionId);
    expect(localStorage.data.promo_pulse_visitor_id).toBe(
      firstPayload.visitorId,
    );
    expect(sessionStorage.data.promo_pulse_session_id).toBe(
      firstPayload.sessionId,
    );
    expect(localStorage.data.promo_pulse_last_seen_campaign_id).toBe(
      "campaign-1",
    );
    expect(localStorage.data.promo_pulse_last_seen_experiment_id).toBe(
      "experiment-1",
    );
    expect(localStorage.data.promo_pulse_last_seen_variant_id).toBe(
      "variant-1",
    );
    expect(
      JSON.parse(localStorage.data.promo_pulse_last_seen_campaign),
    ).toEqual(
      expect.objectContaining({
        campaignId: "campaign-1",
        experimentId: "experiment-1",
        variantId: "variant-1",
        visitorId: firstPayload.visitorId,
        sessionId: firstPayload.sessionId,
        lastPromoTouch: expect.any(Number),
      }),
    );
  });

  it("persists visitorId across sessions and rotates sessionId per sessionStorage", () => {
    const localStorage = createStorage();
    const firstContext = loadDiscountCodeScript({
      localStorage,
      sessionStorage: createStorage(),
    });
    const secondContext = loadDiscountCodeScript({
      localStorage,
      sessionStorage: createStorage(),
    });

    trackCampaign(firstContext, "IMPRESSION");
    trackCampaign(secondContext, "IMPRESSION");

    const [firstPayload] = readFetchPayloads(firstContext);
    const [secondPayload] = readFetchPayloads(secondContext);

    expect(secondPayload.visitorId).toBe(firstPayload.visitorId);
    expect(secondPayload.sessionId).not.toBe(firstPayload.sessionId);
  });

  it("falls back to in-memory IDs when browser storage is blocked", () => {
    const context = loadDiscountCodeScript({
      localStorage: createStorage({}, true),
      sessionStorage: createStorage({}, true),
    });

    expect(() => trackCampaign(context, "IMPRESSION")).not.toThrow();
    expect(() => trackCampaign(context, "CLICK")).not.toThrow();

    const [firstPayload, secondPayload] = readFetchPayloads(context);

    expect(firstPayload.visitorId).toMatch(/^cpv_/);
    expect(firstPayload.sessionId).toMatch(/^cps_/);
    expect(secondPayload.visitorId).toBe(firstPayload.visitorId);
    expect(secondPayload.sessionId).toBe(firstPayload.sessionId);
  });

  it("does not create analytics identity or send events when strict consent is denied", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    const context = loadDiscountCodeScript({
      localStorage,
      sessionStorage,
      settings: { consentMode: "STRICT", respectDoNotTrack: true },
      analyticsProcessingAllowed: false,
    });

    trackCampaign(context, "IMPRESSION");

    expect(context.fetchMock).not.toHaveBeenCalled();
    expect(localStorage.data.promo_pulse_visitor_id).toBeUndefined();
    expect(sessionStorage.data.promo_pulse_session_id).toBeUndefined();
    expect(
      localStorage.data.promo_pulse_last_seen_campaign_id,
    ).toBeUndefined();
  });

  it("omits visitor and session IDs for behavior eligibility when privacy blocks analytics", () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    const context = loadDiscountCodeScript({
      localStorage,
      sessionStorage,
      settings: { consentMode: "STRICT", respectDoNotTrack: true },
      analyticsProcessingAllowed: false,
    });
    const getTracking = (
      context.context.window as {
        PromoPulseGetVisitorSessionTracking: (options?: {
          purpose?: string;
        }) => Record<string, unknown>;
      }
    ).PromoPulseGetVisitorSessionTracking;

    expect(getTracking()).toMatchObject({
      visitorId: "",
      sessionId: "",
      doNotTrack: false,
      consentGranted: false,
    });

    expect(getTracking({ purpose: "uniqueCode" })).toMatchObject({
      visitorId: expect.stringMatching(/^cpv_/),
      sessionId: expect.stringMatching(/^cps_/),
      consentGranted: false,
    });
  });

  it("does not include the unique code value in copy tracking details", () => {
    const loaded = loadDiscountCodeScript({
      localStorage: createStorage(),
      sessionStorage: createStorage(),
    });
    const copyCode = (
      loaded.context.window as {
        PromoPulseCopyCode: (
          code: string,
          campaign: Record<string, string>,
        ) => void;
      }
    ).PromoPulseCopyCode;

    copyCode("SECRET-CODE", {
      id: "campaign-1",
      experimentId: "experiment-1",
      placement: "TOP_BAR",
      variantId: "variant-1",
    });

    const event = loaded.documentMock.dispatchEvent.mock.calls[0]?.[0] as {
      detail: Record<string, unknown>;
      type: string;
    };

    expect(event.type).toBe("promo-pulse:copy-code");
    expect(event.detail).toEqual({
      campaignId: "campaign-1",
      experimentId: "experiment-1",
      placement: "TOP_BAR",
      variantId: "variant-1",
    });
    expect(event.detail).not.toHaveProperty("code");
  });
});

function loadDiscountCodeScript({
  localStorage,
  sessionStorage,
  settings = {},
  analyticsProcessingAllowed,
}: {
  localStorage: ReturnType<typeof createStorage>;
  sessionStorage: ReturnType<typeof createStorage>;
  settings?: Record<string, unknown>;
  analyticsProcessingAllowed?: boolean;
}) {
  const root = {
    dataset: {
      apiBaseUrl: "https://app.example.test",
      cartCurrency: "usd",
      country: "us",
      locale: "en-US",
      shop: "demo.myshopify.com",
    },
  };
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  const customerPrivacy =
    analyticsProcessingAllowed === undefined
      ? undefined
      : {
          analyticsProcessingAllowed: vi.fn(() => analyticsProcessingAllowed),
        };
  const windowMock = {
    PromoPulseSettings: settings,
    Shopify: { shop: "demo.myshopify.com", customerPrivacy },
    crypto: createCryptoMock(),
    doNotTrack: "0",
    fetch: fetchMock,
    localStorage,
    location: {
      href: "https://demo.myshopify.com/products/hat",
      hostname: "demo.myshopify.com",
      pathname: "/products/hat",
    },
    navigator: {
      doNotTrack: "0",
      language: "en-US",
      userAgent: "vitest",
    },
    sessionStorage,
  } as Record<string, unknown>;
  const documentMock = {
    addEventListener: vi.fn(),
    createElement: vi.fn(),
    dispatchEvent: vi.fn(),
    documentElement: { lang: "en-US" },
    getElementById: vi.fn(() => root),
    querySelector: vi.fn(() => root),
  };
  const CustomEventMock = class CustomEvent {
    type: string;
    detail: unknown;

    constructor(type: string, options: { detail?: unknown } = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  const context = vm.createContext({
    console,
    CustomEvent: CustomEventMock,
    Date,
    document: documentMock,
    Math,
    Promise,
    Response,
    URL,
    window: windowMock,
  });

  windowMock.window = windowMock;
  windowMock.document = documentMock;
  windowMock.CustomEvent = CustomEventMock;

  vm.runInContext(source, context);

  return { context, documentMock, fetchMock };
}

function trackCampaign(
  loaded: ReturnType<typeof loadDiscountCodeScript>,
  eventType: string,
) {
  const trackEvent = (
    loaded.context.window as {
      PromoPulseTrackEvent: (
        eventType: string,
        campaign: Record<string, string>,
      ) => void;
    }
  ).PromoPulseTrackEvent;

  trackEvent(eventType, {
    id: "campaign-1",
    experimentId: "experiment-1",
    placement: "TOP_BAR",
    variantId: "variant-1",
  });
}

function readFetchPayloads(loaded: ReturnType<typeof loadDiscountCodeScript>) {
  const calls = loaded.fetchMock.mock.calls as unknown as Array<
    [string, { body: string }]
  >;

  return calls.map(([, init]) => {
    return JSON.parse(init.body) as Record<string, unknown>;
  });
}

function createStorage(initial: Record<string, string> = {}, blocked = false) {
  const data = { ...initial };

  return {
    data,
    getItem: vi.fn((key: string) => {
      if (blocked) throw new Error("Storage blocked");

      return data[key] ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (blocked) throw new Error("Storage blocked");

      data[key] = String(value);
    }),
  };
}

function createCryptoMock() {
  let index = 0;

  return {
    randomUUID: vi.fn(() => {
      index += 1;

      return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    }),
  };
}
