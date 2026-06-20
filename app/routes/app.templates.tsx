import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AppAlert } from "../components/Notifications";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import {
  createDraftCampaignFromTemplate,
  ensureSystemCampaignTemplates,
  getTemplateFilterOptions,
  listTemplateLibrary,
  TemplateLibraryError,
  type TemplateFilterOptions,
  type TemplateLibraryFilters,
} from "../services/templates/templateLibrary.server";
import { formatCampaignOption } from "../types/campaign-options";

type TemplateRow = {
  key: string;
  category: string;
  countryCode: string | null;
  locale: string;
  eventName: string;
  goal: string;
  type: string;
  headline: string;
  subheadline: string;
  aiUrl: string;
};

type LoaderData = {
  filters: TemplateLibraryFilters;
  filterOptions: TemplateFilterOptions;
  lockedReason: string;
  shopifyDomain: string;
  templates: TemplateRow[];
};

type ActionData = {
  error?: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "CAMPAIGN_LIBRARY");
  const url = new URL(request.url);
  const filters = readTemplateFilters(url);

  if (!gate.allowed) {
    return {
      filters,
      filterOptions: emptyFilterOptions(),
      lockedReason: gate.reason,
      shopifyDomain: shop.shopifyDomain,
      templates: [],
    };
  }

  await ensureSystemCampaignTemplates();

  const [templates, filterOptions] = await Promise.all([
    listTemplateLibrary(filters),
    getTemplateFilterOptions(),
  ]);

  return {
    filters,
    filterOptions,
    lockedReason: "",
    shopifyDomain: shop.shopifyDomain,
    templates: templates.map((template) => {
      const texts = readTexts(template.defaultTexts);

      return {
        key: template.key,
        category: template.category,
        countryCode: template.countryCode,
        locale: template.locale,
        eventName: template.eventName,
        goal: template.goal,
        type: template.type,
        headline: texts.headline || template.eventName,
        subheadline: texts.subheadline,
        aiUrl: template.aiUrl,
      };
    }),
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "CAMPAIGN_LIBRARY");
  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");
  const templateKey = String(formData.get("templateKey") ?? "");

  if (!gate.allowed) return { error: gate.reason };

  if (intent !== "useTemplate") {
    return { error: "Unsupported template action." };
  }

  if (!templateKey) {
    return { error: "Template key is required." };
  }

  try {
    const campaign = await createDraftCampaignFromTemplate(
      shop.id,
      templateKey,
    );
    const embeddedSearch = new URL(request.url).search;

    return redirect(`/app/campaigns/${campaign.id}${embeddedSearch}`);
  } catch (error) {
    if (error instanceof TemplateLibraryError) {
      return { error: error.message };
    }

    console.error("Failed to create campaign from template", error);
    return { error: "Template could not be applied. Try again." };
  }
};

export default function TemplateLibraryPage() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const actionData = useActionData<typeof action>() as ActionData | undefined;

  return (
    <s-page inlineSize="large" heading="Template Library">
      <s-section>
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Campaign Template Library</s-heading>
            <s-paragraph>
              Start from country-aware, editable campaign drafts for seasonal
              events and proven promotion types.
            </s-paragraph>
            <div className="counterpulse-muted">{data.shopifyDomain}</div>
          </div>
          <div className="counterpulse-dashboard-header__badges">
            <s-badge tone="info">Growth</s-badge>
          </div>
        </div>
      </s-section>

      {data.lockedReason ? (
        <PlanUpgradeCallout
          message={data.lockedReason}
          title="Template Library is locked"
        />
      ) : (
        <>
          {actionData?.error && (
            <AppAlert tone="critical" title="Template action failed">
              <s-paragraph>{actionData.error}</s-paragraph>
            </AppAlert>
          )}

          <TemplateFilters
            filters={data.filters}
            options={data.filterOptions}
          />

          <s-section heading="Templates">
            {data.templates.length === 0 ? (
              <EmptyStateCard
                title="No templates found"
                message="Adjust filters to browse the system template library."
                actionLabel="Clear filters"
                actionHref="/app/templates"
              />
            ) : (
              <div className="counterpulse-template-grid">
                {data.templates.map((template) => (
                  <TemplateCard key={template.key} template={template} />
                ))}
              </div>
            )}
          </s-section>
        </>
      )}
    </s-page>
  );
}

function TemplateFilters({
  filters,
  options,
}: {
  filters: TemplateLibraryFilters;
  options: TemplateFilterOptions;
}) {
  return (
    <s-section heading="Filters">
      <Form
        method="get"
        className="counterpulse-toolbar counterpulse-toolbar--wide"
      >
        <label className="counterpulse-form-field">
          <span>Goal</span>
          <select name="goal" defaultValue={filters.goal ?? ""}>
            <option value="">All goals</option>
            {options.goals.map((goal) => (
              <option key={goal} value={goal}>
                {formatCampaignOption(goal)}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Country</span>
          <select name="country" defaultValue={filters.country ?? ""}>
            <option value="">All countries</option>
            {options.countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Locale</span>
          <select name="locale" defaultValue={filters.locale ?? ""}>
            <option value="">All locales</option>
            {options.locales.map((locale) => (
              <option key={locale} value={locale}>
                {locale}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Season/event</span>
          <select name="eventName" defaultValue={filters.eventName ?? ""}>
            <option value="">All events</option>
            {options.events.map((eventName) => (
              <option key={eventName} value={eventName}>
                {eventName}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Campaign type</span>
          <select name="type" defaultValue={filters.type ?? ""}>
            <option value="">All types</option>
            {options.types.map((type) => (
              <option key={type} value={type}>
                {formatCampaignOption(type)}
              </option>
            ))}
          </select>
        </label>
        <button className="counterpulse-button" type="submit">
          Apply
        </button>
      </Form>
    </s-section>
  );
}

function TemplateCard({ template }: { template: TemplateRow }) {
  return (
    <div className="counterpulse-card counterpulse-template-card">
      <div className="counterpulse-template-card__header">
        <div>
          <div className="counterpulse-recommendation__title">
            {template.eventName}
          </div>
          <div className="counterpulse-muted">{template.headline}</div>
        </div>
        <div className="counterpulse-recommendation__meta">
          <s-badge tone="neutral">
            {formatCampaignOption(template.type)}
          </s-badge>
          <s-badge tone="info">
            {template.countryCode ?? "Global"} / {template.locale}
          </s-badge>
        </div>
      </div>

      {template.subheadline && (
        <div className="counterpulse-muted">{template.subheadline}</div>
      )}

      <div className="counterpulse-recommendation__actions">
        <Form method="post">
          <input name="_action" type="hidden" value="useTemplate" />
          <input name="templateKey" type="hidden" value={template.key} />
          <button className="counterpulse-button" type="submit">
            Use template
          </button>
        </Form>
        <Link className="counterpulse-button-secondary" to={template.aiUrl}>
          Generate variants from template
        </Link>
      </div>
    </div>
  );
}

function readTemplateFilters(url: URL): TemplateLibraryFilters {
  return {
    goal: url.searchParams.get("goal") ?? "",
    country: url.searchParams.get("country") ?? "",
    locale: url.searchParams.get("locale") ?? "",
    eventName: url.searchParams.get("eventName") ?? "",
    type: url.searchParams.get("type") ?? "",
  };
}

function emptyFilterOptions(): TemplateFilterOptions {
  return {
    countries: [],
    events: [],
    goals: [],
    locales: [],
    types: [],
  };
}

function readTexts(value: unknown) {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    headline: typeof input.headline === "string" ? input.headline : "",
    subheadline: typeof input.subheadline === "string" ? input.subheadline : "",
  };
}
