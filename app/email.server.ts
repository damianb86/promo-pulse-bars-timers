import nodemailer from "nodemailer";

const APP_NAME =
  process.env.PROMO_PULSE_APP_NAME || "Promo Pulse: Bars & Timers";
const DEFAULT_FROM_EMAIL = "noreply@zuam.dev";
const DEFAULT_FROM_NAME = "Promo Pulse";

type SendSupportEmailInput = {
  type: string;
  subject: string;
  message: string;
  html?: string;
  replyEmail?: string;
  shop: string;
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
