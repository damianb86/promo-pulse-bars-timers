import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mailerMock = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mailerMock.createTransport,
  },
}));

import { normalizeEmailRecipients, sendContactEmail } from "./email.server";

describe("email.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CONTACT_EMAIL", "");
    vi.stubEnv("EMAIL_HOST", "");
    vi.stubEnv("EMAIL_PORT", "587");
    vi.stubEnv("EMAIL_USER", "");
    vi.stubEnv("EMAIL_PASS", "");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("EMAIL_FROM_NAME", "");
    mailerMock.createTransport.mockReturnValue({
      sendMail: mailerMock.sendMail,
    });
    mailerMock.sendMail.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes comma, semicolon, and newline separated recipients", () => {
    expect(
      normalizeEmailRecipients(
        "support@example.com; invalid\nops@example.com, support@example.com",
      ),
    ).toEqual(["support@example.com", "ops@example.com"]);
  });

  it("logs and returns the payload outside production when SMTP is missing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendContactEmail({
      type: "support",
      subject: "Help",
      message: "Message",
      replyEmail: "merchant@example.com",
      shop: "demo.myshopify.com",
    });

    expect(result).toMatchObject({
      app: "Promo Pulse: Bars & Timers",
      recipients: [],
      shop: "demo.myshopify.com",
      type: "support",
    });
    expect(mailerMock.createTransport).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "[email.server] SMTP not configured; email not sent:",
      expect.objectContaining({ shop: "demo.myshopify.com" }),
    );
  });

  it("throws in production when required SMTP configuration is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      sendContactEmail({
        type: "support",
        subject: "Help",
        message: "Message",
        shop: "demo.myshopify.com",
      }),
    ).rejects.toThrow(
      "Missing email configuration: CONTACT_EMAIL, EMAIL_HOST, EMAIL_USER, EMAIL_PASS",
    );
  });

  it("sends through nodemailer with from, reply-to, recipients, and app headers", async () => {
    vi.stubEnv("CONTACT_EMAIL", "support@example.com,ops@example.com");
    vi.stubEnv("EMAIL_HOST", "smtp.example.com");
    vi.stubEnv("EMAIL_PORT", "587");
    vi.stubEnv("EMAIL_USER", "smtp-user");
    vi.stubEnv("EMAIL_PASS", "smtp-pass");
    vi.stubEnv("EMAIL_FROM", "noreply@example.com");
    vi.stubEnv("EMAIL_FROM_NAME", "Promo Pulse Support");

    await sendContactEmail({
      type: "support",
      subject: "Timer issue",
      message: "Timer is not rendering.",
      replyEmail: "merchant@example.com",
      shop: "demo.myshopify.com",
    });

    expect(mailerMock.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "smtp-user",
        pass: "smtp-pass",
      },
    });
    expect(mailerMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: {
          name: "Promo Pulse Support",
          address: "noreply@example.com",
        },
        to: ["support@example.com", "ops@example.com"],
        replyTo: "merchant@example.com",
        subject: "[Promo Pulse: Bars & Timers] Timer issue",
        headers: {
          "X-Promo-Pulse-Shop": "demo.myshopify.com",
          "X-Promo-Pulse-Type": "support",
        },
      }),
    );
  });
});
