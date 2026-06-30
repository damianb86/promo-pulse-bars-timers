import nodemailer from "nodemailer";

const APP_NAME =
  process.env.PROMO_PULSE_APP_NAME || "Promo Pulse: Bars & Timers";
const DEFAULT_FROM_EMAIL = "noreply@zuam.dev";
const DEFAULT_FROM_NAME = "Promo Pulse";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

type SendSupportEmailInput = {
  type: string;
  subject: string;
  message: string;
  html?: string;
  replyEmail?: string;
  shop: string;
  attachments?: EmailAttachment[];
};

type SendPromoPulseEmailInput = SendSupportEmailInput & {
  to?: string | string[];
  requiredRecipientEnv?: string;
};

export type SentEmailPayload = {
  app: string;
  type: string;
  subject: string;
  message: string;
  replyEmail?: string;
  shop: string;
  recipient: string;
  recipients: string[];
};

function getSmtpConfig() {
  const configuredPort = Number(process.env.EMAIL_PORT ?? 587);
  const port = Number.isFinite(configuredPort) ? configuredPort : 587;
  const configuredSecure = process.env.EMAIL_SECURE;

  return {
    host: process.env.EMAIL_HOST,
    port,
    secure:
      configuredSecure === undefined
        ? port === 465
        : configuredSecure.toLowerCase() === "true",
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    recipient: process.env.CONTACT_EMAIL,
    fromEmail: process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL,
    fromName: process.env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME,
    replyToEmail: process.env.EMAIL_REPLY_TO || process.env.CONTACT_EMAIL,
  };
}

// Sends a "Ask our team to review" request for an AI-generated campaign: all the
// merchant's inputs + the goal they described + the uploaded reference image (as
// an attachment). Goes to the app's contact inbox (CONTACT_EMAIL).
export async function sendCampaignReviewEmail(input: {
  shop: string;
  replyEmail?: string;
  goalDetail: string;
  fields: Array<{ label: string; value: string }>;
  attachments?: EmailAttachment[];
}): Promise<SentEmailPayload> {
  const recipient = getSmtpConfig().recipient;
  const rows = input.fields
    .filter((field) => field.value)
    .map(
      (field) =>
        `<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top">${escapeHtml(
          field.label,
        )}</td><td style="padding:4px 0">${escapeHtml(field.value)}</td></tr>`,
    )
    .join("");
  const html = [
    "<h2>AI campaign review request</h2>",
    `<p><strong>Shop:</strong> ${escapeHtml(input.shop)}</p>`,
    `<p><strong>Reply email:</strong> ${escapeHtml(
      input.replyEmail || "not provided",
    )}</p>`,
    "<h3>What they're trying to achieve</h3>",
    `<p>${escapeHtml(input.goalDetail).replace(/\n/g, "<br>")}</p>`,
    "<h3>Campaign inputs</h3>",
    `<table style="border-collapse:collapse">${rows}</table>`,
    input.attachments?.length
      ? `<p><em>${input.attachments.length} reference image(s) attached.</em></p>`
      : "",
  ].join("\n");

  const message = [
    `Reply email: ${input.replyEmail ?? "not provided"}`,
    "",
    "What they're trying to achieve:",
    input.goalDetail,
    "",
    "Campaign inputs:",
    ...input.fields
      .filter((field) => field.value)
      .map((field) => `- ${field.label}: ${field.value}`),
  ].join("\n");

  return sendPromoPulseEmail({
    type: "ai-campaign-review",
    subject: "AI campaign review request",
    message,
    html,
    replyEmail: input.replyEmail,
    shop: input.shop,
    attachments: input.attachments,
    to: recipient,
    requiredRecipientEnv: "CONTACT_EMAIL",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactEmail(input: SendSupportEmailInput) {
  return sendPromoPulseEmail({
    ...input,
    message: [
      `Reply email: ${input.replyEmail ?? "not provided"}`,
      "",
      input.message,
    ].join("\n"),
    to: getSmtpConfig().recipient,
    requiredRecipientEnv: "CONTACT_EMAIL",
  });
}

export async function sendPromoPulseEmail({
  type,
  subject,
  message,
  html,
  replyEmail,
  shop,
  to,
  attachments,
  requiredRecipientEnv = "email recipient",
}: SendPromoPulseEmailInput): Promise<SentEmailPayload> {
  const smtp = getSmtpConfig();
  const recipients = normalizeEmailRecipients(to);
  const normalizedReplyEmail = isValidEmail(replyEmail)
    ? replyEmail
    : isValidEmail(smtp.replyToEmail)
      ? smtp.replyToEmail
      : undefined;
  const payload = {
    app: APP_NAME,
    type,
    subject,
    message,
    replyEmail: normalizedReplyEmail,
    shop,
    recipient: recipients.join(", "),
    recipients,
  };

  const missing = [
    [requiredRecipientEnv, recipients.length ? recipients.join(", ") : ""],
    ["EMAIL_HOST", smtp.host],
    ["EMAIL_USER", smtp.user],
    ["EMAIL_PASS", smtp.pass],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (
    process.env.E2E_TEST_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    console.log("[email.server] E2E mode; email not sent:", payload);
    return payload;
  }

  if (missing.length > 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing email configuration: ${missing.join(", ")}`);
    }

    console.log("[email.server] SMTP not configured; email not sent:", payload);
    return payload;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: { name: smtp.fromName, address: smtp.fromEmail },
    to: recipients,
    replyTo: normalizedReplyEmail,
    subject: `[${APP_NAME}] ${subject || type}`,
    text: [`App: ${APP_NAME}`, `Shop: ${shop}`, `Type: ${type}`, "", message]
      .filter(Boolean)
      .join("\n"),
    html,
    attachments,
    headers: {
      "X-Promo-Pulse-Shop": shop,
      "X-Promo-Pulse-Type": type,
    },
  });

  return payload;
}

export function normalizeEmailRecipients(value?: string | string[]) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,\n;]/)
        .map((item) => item.trim());

  return [...new Set(values.filter(isValidEmail))];
}

export function isValidEmail(value?: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}
