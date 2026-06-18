import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { describe, expect, it, vi } from "vitest";

const sourcePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../theme-extension-src/counterpulse-theme/discount-code.js",
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
    expect(localStorage.data.counterpulse_visitor_id).toBe(
      firstPayload.visitorId,
    );
    expect(sessionStorage.data.counterpulse_session_id).toBe(
      firstPayload.sessionId,
    );
    expect(localStorage.data.counterpulse_last_seen_campaign_id).toBe(
      "campaign-1",
    );
    expect(localStorage.data.counterpulse_last_seen_experiment_id).toBe(
      "experiment-1",
    );
    expect(localStorage.data.counterpulse_last_seen_variant_id).toBe(
      "variant-1",
    );
    expect(
      JSON.parse(localStorage.data.counterpulse_last_seen_campaign),
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
});

function loadDiscountCodeScript({
  localStorage,
  sessionStorage,
}: {
  localStorage: ReturnType<typeof createStorage>;
  sessionStorage: ReturnType<typeof createStorage>;
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
  const windowMock = {
    CounterPulseSettings: {},
    Shopify: { shop: "demo.myshopify.com" },
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

  return { context, fetchMock };
}

function trackCampaign(
  loaded: ReturnType<typeof loadDiscountCodeScript>,
  eventType: string,
) {
  const trackEvent = (
    loaded.context.window as {
      CounterPulseTrackEvent: (
        eventType: string,
        campaign: Record<string, string>,
      ) => void;
    }
  ).CounterPulseTrackEvent;

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
