import type { CSSProperties } from "react";
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
  createTemplateFromCampaign,
  createDraftCampaignFromTemplate,
  ensureSystemCampaignTemplates,
  getTemplateFilterOptions,
  listTemplateSourceCampaigns,
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
  isSystem: boolean;
  placementType: string;
  preview: TemplatePreviewData;
  sourceLabel: string;
  subheadline: string;
  aiUrl: string;
};

type LoaderData = {
  filters: TemplateLibraryFilters;
  filterOptions: TemplateFilterOptions;
  lockedReason: string;
  shopifyDomain: string;
  sourceCampaigns: SourceCampaignRow[];
  templates: TemplateRow[];
};

type ActionData = {
  error?: string;
};

type SourceCampaignRow = {
  id: string;
  name: string;
  placementTypes: string[];
  status: string;
  type: string;
  updatedAt: string;
};

type TemplatePreviewData = {
  accentColor: string;
  background: string;
  buttonColor: string;
  buttonTextColor: string;
  layout: string;
  showButton: boolean;
  showIcon: boolean;
  showProgressBar: boolean;
  templateKey: string;
  textColor: string;
  timerColor: string;
  timerStyle: string;
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
      sourceCampaigns: [],
      templates: [],
    };
  }

  await ensureSystemCampaignTemplates();

  const [templates, filterOptions, sourceCampaigns] = await Promise.all([
    listTemplateLibrary(shop.id, filters),
    getTemplateFilterOptions(shop.id),
    listTemplateSourceCampaigns(shop.id),
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
        isSystem: template.isSystem,
        placementType: readRecommendedPlacement(template.defaultSettings),
        preview: readPreviewData(template.defaultDesign),
        sourceLabel: template.isSystem
          ? "System library"
          : "Saved from campaign",
        subheadline: texts.subheadline,
        aiUrl: template.aiUrl,
      };
    }),
    sourceCampaigns: sourceCampaigns.map((campaign) => ({
      ...campaign,
      updatedAt: campaign.updatedAt.toISOString(),
    })),
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

  if (intent === "createFromCampaign") {
    const campaignId = String(formData.get("campaignId") ?? "");
    const templateName = String(formData.get("templateName") ?? "");

    if (!campaignId) {
      return { error: "Choose a campaign to save as a template." };
    }

    try {
      await createTemplateFromCampaign(shop.id, campaignId, {
        name: templateName,
      });

      return redirect("/app/templates?created=1");
    } catch (error) {
      if (error instanceof TemplateLibraryError) {
        return { error: error.message };
      }

      console.error("Failed to create template from campaign", error);
      return { error: "Template could not be created. Try again." };
    }
  }

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
  const systemCount = data.templates.filter(
    (template) => template.isSystem,
  ).length;
  const customCount = data.templates.length - systemCount;

  return (
    <s-page inlineSize="large" heading="Template Library">
      <div className="counterpulse-template-library">
        <section className="counterpulse-template-library__hero">
          <div>
            <span className="counterpulse-template-library__eyebrow">
              US English libraries
            </span>
            <h2>Campaign Template Library</h2>
            <p>
              Start from country-aware, editable campaign drafts for seasonal
              events and proven promotion types.
            </p>
            <div className="counterpulse-template-library__meta">
              <span>{data.shopifyDomain}</span>
              <span>{data.templates.length} templates</span>
              <span>{customCount} saved from campaigns</span>
            </div>
          </div>
          <div className="counterpulse-template-library__insight">
            <div
              className="counterpulse-template-library__globe"
              aria-hidden="true"
            />
            <p>
              Templates are tuned for US storefront copy, placements, design
              presets, and variant generation.
            </p>
          </div>
        </section>

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

            <CreateTemplateFromCampaign campaigns={data.sourceCampaigns} />

            <TemplateFilters
              filters={data.filters}
              options={data.filterOptions}
              templateCount={data.templates.length}
            />

            <section className="counterpulse-template-library__summary">
              <div className="counterpulse-template-library__chips">
                <a
                  className={!data.filters.category ? "is-active" : ""}
                  href={buildTemplateHref(data.filters, { category: "" })}
                >
                  All templates <span>{data.templates.length}</span>
                </a>
                <a
                  className={
                    data.filters.category === "HOLIDAY" ? "is-active" : ""
                  }
                  href={buildTemplateHref(data.filters, {
                    category: "HOLIDAY",
                  })}
                >
                  Seasonal{" "}
                  <span>{countCategory(data.templates, "HOLIDAY")}</span>
                </a>
                <a
                  className={
                    data.filters.type === "COUNTDOWN_BAR" ? "is-active" : ""
                  }
                  href={buildTemplateHref(data.filters, {
                    category: "",
                    type: "COUNTDOWN_BAR",
                  })}
                >
                  Countdown bar{" "}
                  <span>{countType(data.templates, "COUNTDOWN_BAR")}</span>
                </a>
                <a
                  className={
                    data.filters.category === "CART_RECOVERY" ? "is-active" : ""
                  }
                  href={buildTemplateHref(data.filters, {
                    category: "CART_RECOVERY",
                  })}
                >
                  Cart and checkout{" "}
                  <span>{countCategory(data.templates, "CART_RECOVERY")}</span>
                </a>
                <a
                  className={
                    data.filters.category === "PRODUCT_LAUNCH"
                      ? "is-active"
                      : ""
                  }
                  href={buildTemplateHref(data.filters, {
                    category: "PRODUCT_LAUNCH",
                  })}
                >
                  Product{" "}
                  <span>{countCategory(data.templates, "PRODUCT_LAUNCH")}</span>
                </a>
              </div>
              <div className="counterpulse-template-library__sort">
                <span>{systemCount} system</span>
                <span>{customCount} custom</span>
              </div>
            </section>

            {data.templates.length === 0 ? (
              <EmptyStateCard
                title="No templates found"
                message="Adjust filters to browse the template library."
                actionLabel="Clear filters"
                actionHref="/app/templates"
              />
            ) : (
              <section className="counterpulse-template-grid">
                {data.templates.map((template) => (
                  <TemplateCard key={template.key} template={template} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </s-page>
  );
}

function TemplateFilters({
  filters,
  options,
  templateCount,
}: {
  filters: TemplateLibraryFilters;
  options: TemplateFilterOptions;
  templateCount: number;
}) {
  return (
    <section className="counterpulse-template-filters">
      <div className="counterpulse-template-filters__header">
        <div>
          <h3>Search templates</h3>
          <p>Filter by goal, US market defaults, event, and campaign type.</p>
        </div>
        <span>{templateCount} results</span>
      </div>
      <Form method="get" className="counterpulse-template-filters__form">
        <input name="category" type="hidden" value={filters.category ?? ""} />
        <label className="counterpulse-form-field counterpulse-template-filters__search">
          <span>Search templates</span>
          <input
            name="query"
            type="search"
            defaultValue={filters.query ?? ""}
            placeholder="Search by name or keyword..."
          />
        </label>
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
        <label className="counterpulse-form-field">
          <span>Sort by</span>
          <select name="sort" defaultValue={filters.sort ?? ""}>
            <option value="">Recommended</option>
            <option value="newest">Updated newest</option>
            <option value="name">Name</option>
          </select>
        </label>
        <button className="counterpulse-button" type="submit">
          Apply
        </button>
        <Link className="counterpulse-button-secondary" to="/app/templates">
          Clear
        </Link>
      </Form>
    </section>
  );
}

function CreateTemplateFromCampaign({
  campaigns,
}: {
  campaigns: SourceCampaignRow[];
}) {
  return (
    <section className="counterpulse-template-create">
      <div>
        <h3>Create from an existing campaign</h3>
        <p>
          Save a reusable template from campaign copy, placements, design, and
          editable behavior settings.
        </p>
      </div>
      <Form method="post" className="counterpulse-template-create__form">
        <input name="_action" type="hidden" value="createFromCampaign" />
        <label className="counterpulse-form-field">
          <span>Campaign</span>
          <select name="campaignId" disabled={campaigns.length === 0} required>
            <option value="">
              {campaigns.length === 0
                ? "No campaigns available"
                : "Select campaign"}
            </option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} - {formatCampaignOption(campaign.type)}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Template name</span>
          <input
            name="templateName"
            placeholder="Optional custom name"
            type="text"
          />
        </label>
        <button
          className="counterpulse-button"
          disabled={campaigns.length === 0}
          type="submit"
        >
          Save template
        </button>
      </Form>
    </section>
  );
}

function TemplateCard({ template }: { template: TemplateRow }) {
  const previewStyle = {
    "--cp-template-accent": template.preview.accentColor,
    "--cp-template-button": template.preview.buttonColor,
    "--cp-template-button-text": template.preview.buttonTextColor,
    "--cp-template-timer": template.preview.timerColor,
    background: template.preview.background,
    color: template.preview.textColor,
  } as CSSProperties;

  return (
    <article className="counterpulse-template-card">
      <div className="counterpulse-template-card__preview" style={previewStyle}>
        <button aria-label={`Preview ${template.eventName}`} type="button" />
        <div className="counterpulse-template-card__preview-copy">
          <span>{template.subheadline || template.sourceLabel}</span>
          <strong>{template.headline}</strong>
        </div>
        {template.type === "PRODUCT_BADGE" ? (
          <div className="counterpulse-template-card__badge-preview">
            {template.headline}
          </div>
        ) : (
          <div
            className={`counterpulse-template-card__timer counterpulse-template-card__timer--${template.preview.timerStyle.toLowerCase()}`}
          >
            <span>02</span>
            <span>14</span>
            <span>32</span>
            <span>45</span>
          </div>
        )}
        {template.preview.showButton && (
          <span className="counterpulse-template-card__cta">Shop now</span>
        )}
        {template.preview.showProgressBar && (
          <div className="counterpulse-template-card__progress">
            <span />
          </div>
        )}
      </div>

      <div className="counterpulse-template-card__body">
        <div className="counterpulse-template-card__title-row">
          <div>
            <h3>{template.eventName}</h3>
            <p>{template.subheadline || template.headline}</p>
          </div>
          <span
            className={
              template.isSystem
                ? "counterpulse-template-card__source"
                : "counterpulse-template-card__source counterpulse-template-card__source--custom"
            }
          >
            {template.isSystem ? "System" : "Custom"}
          </span>
        </div>

        <div className="counterpulse-template-card__meta">
          <span>{formatCampaignOption(template.type)}</span>
          <span>{formatCampaignOption(template.placementType)}</span>
          <span>
            {template.countryCode ?? "US"} / {template.locale}
          </span>
        </div>

        <div className="counterpulse-template-card__actions">
          <Form method="post">
            <input name="_action" type="hidden" value="useTemplate" />
            <input name="templateKey" type="hidden" value={template.key} />
            <button className="counterpulse-button" type="submit">
              Use template
            </button>
          </Form>
          <Link className="counterpulse-button-secondary" to={template.aiUrl}>
            Generate variants
          </Link>
        </div>
      </div>
    </article>
  );
}

function readTemplateFilters(url: URL): TemplateLibraryFilters {
  return {
    category: url.searchParams.get("category") ?? "",
    goal: url.searchParams.get("goal") ?? "",
    country: url.searchParams.get("country") ?? "",
    locale: url.searchParams.get("locale") ?? "",
    eventName: url.searchParams.get("eventName") ?? "",
    query: url.searchParams.get("query") ?? "",
    sort: url.searchParams.get("sort") ?? "",
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

function readRecommendedPlacement(value: unknown) {
  const input = readObject(value);
  const placement = input.recommendedPlacement;

  return typeof placement === "string" && placement.trim()
    ? placement
    : "TOP_BAR";
}

function readPreviewData(value: unknown): TemplatePreviewData {
  const input = readObject(value);
  const backgroundType = readString(input.backgroundType) || "SOLID";
  const gradientStartColor = readString(input.gradientStartColor) || "#111827";
  const gradientEndColor = readString(input.gradientEndColor) || "#312E81";
  const gradientAngle = readNumber(input.gradientAngle, 135);
  const backgroundColor = readString(input.backgroundColor) || "#FFFFFF";

  return {
    accentColor: readString(input.accentColor) || "#008060",
    background:
      backgroundType === "GRADIENT"
        ? `linear-gradient(${gradientAngle}deg, ${gradientStartColor}, ${gradientEndColor})`
        : backgroundColor,
    buttonColor: readString(input.buttonColor) || "#008060",
    buttonTextColor: readString(input.buttonTextColor) || "#FFFFFF",
    layout: readString(input.layout) || "STANDARD",
    showButton: readBoolean(input.showButton, true),
    showIcon: readBoolean(input.showIcon, false),
    showProgressBar: readBoolean(input.showProgressBar, true),
    templateKey: readString(input.templateKey) || "clean-minimal",
    textColor:
      readString(input.titleColor) || readString(input.textColor) || "#111827",
    timerColor: readString(input.timerColor) || "#111827",
    timerStyle: readString(input.timerStyle) || "PLAIN",
  };
}

function countCategory(templates: TemplateRow[], category: string) {
  return templates.filter((template) => template.category === category).length;
}

function countType(templates: TemplateRow[], type: string) {
  return templates.filter((template) => template.type === type).length;
}

function buildTemplateHref(
  filters: TemplateLibraryFilters,
  overrides: Partial<TemplateLibraryFilters>,
) {
  const params = new URLSearchParams();
  const next = { ...filters, ...overrides };

  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return query ? `/app/templates?${query}` : "/app/templates";
}

function readObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
