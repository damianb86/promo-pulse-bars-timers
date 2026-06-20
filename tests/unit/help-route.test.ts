import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateAdmin: vi.fn(),
  getOrCreateShopByDomain: vi.fn(),
  sendContactEmail: vi.fn(),
  getPromoPulseDataCounts: vi.fn(),
  deletePromoPulseShopData: vi.fn(),
  db: {
    contactRequest: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../../app/services/admin-auth.server", () => ({
  authenticateAdmin: mocks.authenticateAdmin,
}));

vi.mock("../../app/models/shop.server", () => ({
  getOrCreateShopByDomain: mocks.getOrCreateShopByDomain,
}));

vi.mock("../../app/email.server", () => ({
  isValidEmail: (value?: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")),
  sendContactEmail: mocks.sendContactEmail,
}));

vi.mock("../../app/services/privacy.server", () => ({
  getPromoPulseDataCounts: mocks.getPromoPulseDataCounts,
  deletePromoPulseShopData: mocks.deletePromoPulseShopData,
}));

vi.mock("../../app/db.server", () => ({
  default: mocks.db,
}));

const counts = {
  shopRecords: 1,
  sessions: 1,
  settings: 1,
  onboarding: 1,
  campaigns: 2,
  analyticsEvents: 3,
  discountRecords: 4,
  experiments: 5,
  attributionRows: 6,
  emailTimers: 7,
  advancedRules: 8,
  marketRules: 9,
  recommendations: 10,
  agencyAccesses: 11,
  contactRequests: 12,
};

describe("Help route action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAdmin.mockResolvedValue({
      session: { shop: "demo.myshopify.com" },
    });
    mocks.getOrCreateShopByDomain.mockResolvedValue({
      id: "shop-1",
      shopifyDomain: "demo.myshopify.com",
    });
    mocks.db.contactRequest.create.mockResolvedValue({ id: "contact-1" });
    mocks.sendContactEmail.mockResolvedValue({});
    mocks.getPromoPulseDataCounts.mockResolvedValue(counts);
    mocks.deletePromoPulseShopData.mockResolvedValue({
      shopDomain: "demo.myshopify.com",
      shopId: "shop-1",
      deleted: [],
    });
  });

  it("stores a contact request and sends the support email", async () => {
    const { action } = await import("../../app/routes/app.help");
    const formData = new FormData();
    formData.set("intent", "contact");
    formData.set("type", "support");
    formData.set("subject", "Timer issue");
    formData.set("message", "The cart timer is not rendering.");
    formData.set("email", "merchant@example.com");

    const result = await action({
      request: new Request("https://app.example.com/app/help", {
        method: "POST",
        body: formData,
      }),
      context: {} as never,
      params: {},
      pattern: "/app/help",
      url: new URL("https://app.example.com/app/help"),
    });

    expect(result).toMatchObject({
      ok: true,
      intent: "contact",
    });
    expect(mocks.db.contactRequest.create).toHaveBeenCalledWith({
      data: {
        shopId: "shop-1",
        shopDomain: "demo.myshopify.com",
        type: "support",
        subject: "Timer issue",
        message: "The cart timer is not rendering.",
        email: "merchant@example.com",
      },
    });
    expect(mocks.sendContactEmail).toHaveBeenCalledWith({
      type: "support",
      subject: "Timer issue",
      message: "The cart timer is not rendering.",
      replyEmail: "merchant@example.com",
      shop: "demo.myshopify.com",
    });
  });

  it("rejects invalid reply emails before creating contact rows", async () => {
    const { action } = await import("../../app/routes/app.help");
    const formData = new FormData();
    formData.set("intent", "contact");
    formData.set("type", "support");
    formData.set("message", "Please help.");
    formData.set("email", "not-email");

    const result = await action({
      request: new Request("https://app.example.com/app/help", {
        method: "POST",
        body: formData,
      }),
      context: {} as never,
      params: {},
      pattern: "/app/help",
      url: new URL("https://app.example.com/app/help"),
    });

    expect(result).toMatchObject({
      ok: false,
      message: "Enter a valid reply email.",
    });
    expect(mocks.db.contactRequest.create).not.toHaveBeenCalled();
    expect(mocks.sendContactEmail).not.toHaveBeenCalled();
  });

  it("does not report a data summary as sent when the privacy email fails", async () => {
    const { action } = await import("../../app/routes/app.help");
    const formData = new FormData();
    formData.set("intent", "privacy-data-request");
    mocks.sendContactEmail.mockRejectedValue(new Error("SMTP missing"));

    const result = await action({
      request: new Request("https://app.example.com/app/help", {
        method: "POST",
        body: formData,
      }),
      context: {} as never,
      params: {},
      pattern: "/app/help",
      url: new URL("https://app.example.com/app/help"),
    });

    expect(result).toMatchObject({
      ok: false,
      intent: "privacy-data-request",
      counts,
    });
    expect(mocks.getPromoPulseDataCounts).toHaveBeenCalledWith(
      "demo.myshopify.com",
    );
  });

  it("deletes shop data even when the deletion notification email fails", async () => {
    const { action } = await import("../../app/routes/app.help");
    const formData = new FormData();
    formData.set("intent", "privacy-data-delete");
    mocks.sendContactEmail.mockRejectedValue(new Error("SMTP missing"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await action({
      request: new Request("https://app.example.com/app/help", {
        method: "POST",
        body: formData,
      }),
      context: {} as never,
      params: {},
      pattern: "/app/help",
      url: new URL("https://app.example.com/app/help"),
    });

    expect(result).toMatchObject({
      ok: true,
      intent: "privacy-data-delete",
      counts,
    });
    expect(mocks.deletePromoPulseShopData).toHaveBeenCalledWith(
      "demo.myshopify.com",
    );
    expect(error).toHaveBeenCalledWith(
      "[help.privacy-email]",
      expect.any(Error),
    );
  });
});
