import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import {
  AppAlert,
  AppToast,
  useConfirmSubmit,
} from "../components/Notifications";
import { isValidEmail, sendContactEmail } from "../email.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import {
  deletePromoPulseShopData,
  getPromoPulseDataCounts,
  type PromoPulseDataCounts,
} from "../services/privacy.server";
import db from "../db.server";

const DEFAULT_CONTACT_EMAIL = "support@example.com";

type LoaderData = {
  contactEmail: string;
  shopifyDomain: string;
};

type ActionData = {
  ok: boolean;
  intent: "contact" | "privacy-data-request" | "privacy-data-delete";
  message: string;
  counts?: PromoPulseDataCounts;
};

const requestCards: Array<{
  icon: HelpIconType;
  title: string;
  text: string;
  action: string;
  primary?: boolean;
}> = [
  {
    icon: "setup",
    title: "Set up campaigns",
    text: "Get help configuring countdown bars, product timers, cart timers, free shipping goals, delivery cutoffs, low-stock badges, or app embed placement.",
    action: "Request setup help",
    primary: true,
  },
  {
    icon: "mail",
    title: "Contact support",
    text: "Send the store context, campaign, placement, test result, or Shopify theme behavior that needs review.",
    action: "Send message",
  },
  {
    icon: "spark",
    title: "Suggest an improvement",
    text: "Share an idea for campaign templates, market rules, discount logic, reporting, localization, or agency workflows.",
    action: "Send suggestion",
  },
];

const supportAreas: Array<{
  icon: HelpIconType;
  title: string;
  text: string;
}> = [
  {
    icon: "timer",
    title: "Timers and placements",
    text: "Troubleshoot countdown rendering, product and cart placements, theme selectors, app embed setup, and mobile behavior.",
  },
  {
    icon: "discount",
    title: "Discounts and codes",
    text: "Review automatic discounts, unique discount-code pools, shipping offers, expiry behavior, and storefront assignment.",
  },
  {
    icon: "report",
    title: "Analytics and reports",
    text: "Validate impressions, clicks, attribution, experiments, recommendations, reports, and storefront event tracking.",
  },
  {
    icon: "lock",
    title: "Privacy and data deletion",
    text: "Request a data summary or permanently remove all Promo Pulse app data tied to this shop.",
  },
];

const commonTopics = [
  "A storefront block or app embed is not rendering in the expected theme area.",
  "A campaign should display for a market, locale, product, collection, or cart state but does not.",
  "A discount, unique code, or free shipping goal needs validation before launch.",
  "Analytics, reports, or recommendations do not match the expected storefront activity.",
  "A shop needs all app-owned data removed from the database.",
];

const privacyStoredItems = [
  "Shop record, settings, onboarding checklist, and Shopify session records.",
  "Campaigns, placements, targeting, design, translations, timer settings, shipping settings, badge settings, and discount sync settings.",
  "Analytics events, attribution touches, attribution conversions, recommendations, reports source data, and experiment state.",
  "Unique discount-code pools and assignments, email timer records, advanced discounts, market rules, and advanced badge rules.",
  "Multi-store access rows and contact requests submitted from this page.",
];

const privacyDeletedItems = [
  "The in-app delete action removes the Shop record and uses Prisma cascades to remove app-owned data connected to it.",
  "Shopify session rows are removed by shop domain, so the merchant may need to sign in again after deletion.",
  "Compliance `shop/redact` and `app/uninstalled` webhooks reuse the same deletion service.",
  "System campaign templates are not shop-owned and are kept because they are shared app metadata.",
];

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);

  return {
    contactEmail: process.env.CONTACT_EMAIL ?? DEFAULT_CONTACT_EMAIL,
    shopifyDomain: shop.shopifyDomain,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "privacy-data-request") {
    const counts = await getPromoPulseDataCounts(shop.shopifyDomain);

    try {
      await sendContactEmail({
        type: "Privacy: Data summary",
        subject: "Privacy - Promo Pulse data summary requested",
        shop: shop.shopifyDomain,
        message: buildDataSummaryMessage(shop.shopifyDomain, counts),
      });
    } catch (error) {
      console.error("[help.privacy-data-request]", error);
      return {
        ok: false,
        intent: "privacy-data-request",
        message:
          "We could not send the data summary email. Check email configuration and try again.",
        counts,
      };
    }

    return {
      ok: true,
      intent: "privacy-data-request",
      counts,
      message: "Data summary sent to our team.",
    };
  }

  if (intent === "privacy-data-delete") {
    const counts = await getPromoPulseDataCounts(shop.shopifyDomain);

    try {
      await deletePromoPulseShopData(shop.shopifyDomain);
    } catch (error) {
      console.error("[help.privacy-data-delete]", error);
      return {
        ok: false,
        intent: "privacy-data-delete",
        message:
          "We could not delete all Promo Pulse data. Please contact support and we will complete the request manually.",
        counts,
      };
    }

    await sendPrivacyNotification({
      shopDomain: shop.shopifyDomain,
      subject: "Privacy - Merchant deleted all Promo Pulse data",
      message: [
        `Shop: ${shop.shopifyDomain}`,
        "",
        "The merchant requested deletion of all Promo Pulse app data from the Help and Contact page.",
        "",
        buildDataSummaryMessage(shop.shopifyDomain, counts),
      ].join("\n"),
    });

    return {
      ok: true,
      intent: "privacy-data-delete",
      counts,
      message:
        "All Promo Pulse data for this shop has been permanently deleted. You may be asked to sign in again.",
    };
  }

  if (intent !== "contact") {
    return {
      ok: false,
      intent: "contact",
      message: "Unsupported help action.",
    };
  }

  const type = String(formData.get("type") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const replyEmail = String(formData.get("email") ?? "").trim();

  if (!type || !message) {
    return {
      ok: false,
      intent: "contact",
      message: "Message is required.",
    };
  }

  if (replyEmail && !isValidEmail(replyEmail)) {
    return {
      ok: false,
      intent: "contact",
      message: "Enter a valid reply email.",
    };
  }

  try {
    await db.contactRequest.create({
      data: {
        shopId: shop.id,
        shopDomain: shop.shopifyDomain,
        type,
        subject: subject || type,
        message,
        email: replyEmail || null,
      },
    });

    await sendContactEmail({
      type,
      subject: subject || type,
      message,
      replyEmail: replyEmail || undefined,
      shop: shop.shopifyDomain,
    });

    return {
      ok: true,
      intent: "contact",
      message: "Message sent. We will get back to you soon.",
    };
  } catch (error) {
    console.error("[help.contact]", error);
    return {
      ok: false,
      intent: "contact",
      message:
        "Message could not be sent. Check email configuration and try again.",
    };
  }
};

export default function HelpPage() {
  const { contactEmail, shopifyDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const activeIntent = navigation.formData?.get("intent");
  const isSubmitting = navigation.state === "submitting";
  const isContactSubmitting = isSubmitting && activeIntent === "contact";
  const isPrivacySubmitting =
    isSubmitting &&
    (activeIntent === "privacy-data-request" ||
      activeIntent === "privacy-data-delete");
  const deleteConfirm = useConfirmSubmit({
    confirmLabel: "Delete permanently",
    title: "Delete all Promo Pulse data?",
    tone: "critical",
    children: (
      <p>
        This permanently removes the shop record, sessions, campaigns, settings,
        analytics, discount records, experiments, email timers, recommendations,
        market rules, agency access, and contact requests tied to this shop.
        This action cannot be undone.
      </p>
    ),
  });

  return (
    <s-page inlineSize="large" heading="Help and Contact">
      {actionData?.ok && (
        <AppToast tone="success" title="Request handled">
          <s-paragraph>
            {actionData.message}
            {actionData.counts ? ` ${formatCounts(actionData.counts)}` : ""}
          </s-paragraph>
        </AppToast>
      )}

      {actionData && !actionData.ok && (
        <AppAlert tone="critical" title="Request could not be completed">
          <s-paragraph>{actionData.message}</s-paragraph>
        </AppAlert>
      )}

      <s-section>
        <div className="counterpulse-help-hero">
          <div>
            <div className="counterpulse-help-kicker">Promo Pulse support</div>
            <s-heading>
              Get help with campaign setup, storefront behavior, and shop data.
            </s-heading>
            <s-paragraph>
              Use this page when a campaign placement, timer, discount,
              localization rule, report, recommendation, or privacy request
              needs review.
            </s-paragraph>
            <div className="counterpulse-muted">{shopifyDomain}</div>
          </div>
          <div className="counterpulse-help-hero__actions">
            <a className="counterpulse-button" href="#help-contact-form">
              Request setup help
            </a>
            <a
              className="counterpulse-button-secondary"
              href="#help-contact-form"
            >
              Contact support
            </a>
          </div>
        </div>
      </s-section>

      <s-section heading="Contact options">
        <div className="counterpulse-help-card-grid">
          {requestCards.map((card) => (
            <article className="counterpulse-help-card" key={card.title}>
              <span
                className={
                  card.primary
                    ? "counterpulse-help-icon counterpulse-help-icon--primary"
                    : "counterpulse-help-icon"
                }
                aria-hidden="true"
              >
                <HelpIcon type={card.icon} />
              </span>
              <div>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </div>
              <a
                className={
                  card.primary
                    ? "counterpulse-button"
                    : "counterpulse-button-secondary"
                }
                href="#help-contact-form"
              >
                {card.action}
              </a>
            </article>
          ))}
        </div>
      </s-section>

      <s-section heading="How support can help">
        <div className="counterpulse-help-service-grid">
          {supportAreas.map((service) => (
            <div className="counterpulse-help-service" key={service.title}>
              <span className="counterpulse-help-icon" aria-hidden="true">
                <HelpIcon type={service.icon} />
              </span>
              <div>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </div>
            </div>
          ))}
        </div>
      </s-section>

      <s-section heading="Direct contact">
        <div className="counterpulse-help-direct">
          <div>
            <s-heading>Email support</s-heading>
            <s-paragraph>
              Prefer email? Include the shop, campaign name, placement, and
              expected outcome.
            </s-paragraph>
            <div className="counterpulse-help-email">{contactEmail}</div>
          </div>
          <a
            className="counterpulse-button-secondary"
            href="#help-contact-form"
          >
            Send from app
          </a>
        </div>
      </s-section>

      <s-section heading="Send a support message">
        <Form
          className="counterpulse-form"
          id="help-contact-form"
          method="post"
        >
          <input name="intent" type="hidden" value="contact" />
          <div className="counterpulse-form-grid">
            <label className="counterpulse-form-field">
              Contact type
              <select name="type" defaultValue="support">
                <option value="setup">Setup help</option>
                <option value="support">Support question</option>
                <option value="suggestion">Suggestion</option>
              </select>
            </label>
            <label className="counterpulse-form-field">
              Subject
              <input
                name="subject"
                placeholder="Campaign, timer, discount, report, or data request"
              />
            </label>
            <label className="counterpulse-form-field">
              Reply email
              <input name="email" placeholder="you@store.com" type="email" />
            </label>
            <label className="counterpulse-form-field counterpulse-form-field--full">
              Message
              <textarea
                name="message"
                placeholder="Include the campaign name, placement, expected behavior, and what happened instead."
                required
                rows={5}
              />
            </label>
          </div>
          <div className="counterpulse-actions">
            <button
              className="counterpulse-button"
              disabled={isContactSubmitting}
              type="submit"
            >
              {isContactSubmitting ? "Sending..." : "Send message"}
            </button>
          </div>
        </Form>
      </s-section>

      <s-section heading="Common support topics">
        <ul className="counterpulse-help-topic-list">
          {commonTopics.map((topic) => (
            <li key={topic}>
              <span aria-hidden="true">+</span>
              <p>{topic}</p>
            </li>
          ))}
        </ul>
      </s-section>

      <s-section heading="Data and privacy">
        <div className="counterpulse-help-privacy">
          <div>
            <h2>Stored for this shop</h2>
            <ul>
              {privacyStoredItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Deletion behavior</h2>
            <ul>
              {privacyDeletedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="counterpulse-help-privacy-actions">
          <Form method="post">
            <input name="intent" type="hidden" value="privacy-data-request" />
            <button
              className="counterpulse-button-secondary"
              disabled={isPrivacySubmitting}
              type="submit"
            >
              {isPrivacySubmitting && activeIntent === "privacy-data-request"
                ? "Sending..."
                : "Request data summary"}
            </button>
          </Form>
          <Form method="post" onSubmit={deleteConfirm.onSubmit}>
            <input name="intent" type="hidden" value="privacy-data-delete" />
            <button
              className="counterpulse-button-danger"
              disabled={isPrivacySubmitting}
              type="submit"
            >
              {isPrivacySubmitting && activeIntent === "privacy-data-delete"
                ? "Deleting..."
                : "Delete all shop data"}
            </button>
          </Form>
        </div>
      </s-section>

      {deleteConfirm.modal}
    </s-page>
  );
}

async function sendPrivacyNotification({
  shopDomain,
  subject,
  message,
}: {
  shopDomain: string;
  subject: string;
  message: string;
}) {
  try {
    await sendContactEmail({
      type: "Privacy: Data deleted",
      subject,
      shop: shopDomain,
      message,
    });
  } catch (error) {
    console.error("[help.privacy-email]", error);
  }
}

function buildDataSummaryMessage(
  shopDomain: string,
  counts: PromoPulseDataCounts,
) {
  return [
    `Shop: ${shopDomain}`,
    "",
    "Data currently stored for this shop:",
    `- Shop records: ${counts.shopRecords}`,
    `- Shopify sessions: ${counts.sessions}`,
    `- Shop settings: ${counts.settings}`,
    `- Onboarding checklist rows: ${counts.onboarding}`,
    `- Campaigns: ${counts.campaigns}`,
    `- Analytics events: ${counts.analyticsEvents}`,
    `- Discount records: ${counts.discountRecords}`,
    `- Experiments: ${counts.experiments}`,
    `- Attribution rows: ${counts.attributionRows}`,
    `- Email timers: ${counts.emailTimers}`,
    `- Advanced rules: ${counts.advancedRules}`,
    `- Market rules: ${counts.marketRules}`,
    `- Recommendations: ${counts.recommendations}`,
    `- Multi-store access rows: ${counts.agencyAccesses}`,
    `- Contact requests: ${counts.contactRequests}`,
    "",
    "Promo Pulse stores app-owned configuration and campaign performance records. The in-app delete action removes shop-owned app data and sessions for this shop.",
  ].join("\n");
}

function formatCounts(counts: PromoPulseDataCounts) {
  return [
    `${counts.campaigns} campaign(s)`,
    `${counts.analyticsEvents} analytics event(s)`,
    `${counts.discountRecords} discount record(s)`,
    `${counts.experiments} experiment(s)`,
    `${counts.emailTimers} email timer(s)`,
    `${counts.contactRequests} contact request(s)`,
  ].join(", ");
}

type HelpIconType =
  | "setup"
  | "mail"
  | "spark"
  | "timer"
  | "discount"
  | "report"
  | "lock";

function HelpIcon({ type }: { type: HelpIconType }) {
  if (type === "setup") {
    return (
      <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M4 7h7M4 17h7M13 12h7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <circle cx="16" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (type === "spark") {
    return (
      <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M12 3 9.8 9.8 3 12l6.8 2.2L12 21l2.2-6.8L21 12l-6.8-2.2L12 3Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (type === "timer") {
    return (
      <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
        <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 13V9m-3-6h6m-3 0v3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (type === "discount") {
    return (
      <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="m4 13 7-7 8 8-7 7H4v-8Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="m9 13 4 4m0-4-4 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (type === "report") {
    return (
      <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M5 19V5m0 14h14M9 16v-5m4 5V8m4 8v-3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (type === "lock") {
    return (
      <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M6 10h12v10H6V10Zm2 0V7a4 4 0 0 1 8 0v3"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path
        d="M4 6h16v12H4V6Zm0 1 8 6 8-6"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
