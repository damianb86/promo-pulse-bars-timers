import { createContext, useContext, type ReactNode } from "react";

import {
  type CampaignDesignImageOption,
  type CampaignDesignTemplate,
  type CampaignDesignValues,
} from "../../types/campaign-design";

export const DesignPanelFilterContext = createContext<ReadonlySet<string> | null>(
  null,
);

export type ColorDesignKey = {
  [Key in keyof CampaignDesignValues]: CampaignDesignValues[Key] extends string
    ? Key
    : never;
}[keyof CampaignDesignValues];

export type NumberDesignKey = {
  [Key in keyof CampaignDesignValues]: CampaignDesignValues[Key] extends number
    ? Key
    : never;
}[keyof CampaignDesignValues];

export type BackgroundImageDesignKey =
  | "backgroundImageSize"
  | "backgroundImagePosition"
  | "backgroundImageRepeat"
  | "backgroundImageAttachment";

export function PreviewSelectDropdown({
  isOpen,
  label,
  preview,
  selectedLabel,
  children,
  onClose,
  onToggle,
}: {
  isOpen: boolean;
  label: string;
  preview: ReactNode;
  selectedLabel: string;
  children: ReactNode;
  onClose: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={
        isOpen
          ? "counterpulse-preview-select is-open"
          : "counterpulse-preview-select"
      }
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;

        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        ) {
          onClose();
        }
      }}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className="counterpulse-preview-select__button"
        type="button"
        onClick={onToggle}
      >
        <span className="counterpulse-preview-select__visual">{preview}</span>
        <span className="counterpulse-preview-select__content">
          <strong>{selectedLabel}</strong>
        </span>
        <span className="counterpulse-preview-select__chevron" aria-hidden />
      </button>
      {isOpen ? (
        <div className="counterpulse-preview-select__menu" role="listbox">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function TemplatePreview({ template }: { template: CampaignDesignTemplate }) {
  return (
    <span
      className="counterpulse-template__swatch counterpulse-template__swatch--dropdown"
      style={{
        background:
          template.backgroundType === "GRADIENT"
            ? `linear-gradient(${template.gradientAngle}deg, ${template.gradientStartColor}, ${template.gradientEndColor})`
            : template.backgroundColor,
        borderColor: template.accentColor,
        color: template.titleColor,
      }}
    >
      <span style={{ background: template.timerColor }} />
    </span>
  );
}

export type CardControlIconKind =
  | "align"
  | "borderSize"
  | "duration"
  | "eyedropper"
  | "gap"
  | "horizontalPadding"
  | "iconSize"
  | "image"
  | "maxWidth"
  | "radius"
  | "timer"
  | "typography"
  | "verticalPadding";

export function CardControlIcon({ kind }: { kind: CardControlIconKind }) {
  const common = {
    "aria-hidden": true,
    focusable: false,
    viewBox: "0 0 24 24",
  };

  if (kind === "image") {
    return (
      <svg {...common}>
        <rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m7 16 3.5-4 2.5 3 2-2.3L18 16"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "eyedropper") {
    return (
      <svg {...common}>
        <path
          d="m14.5 5.5 4 4M13 7l4 4-7.8 7.8H5.2V14.8L13 7Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "radius") {
    return (
      <svg {...common}>
        <path
          d="M6 15v-3a6 6 0 0 1 6-6h3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "borderSize") {
    return (
      <svg {...common}>
        <path
          d="M7 8h10M9 12h6M10.5 16h3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "align") {
    return (
      <svg {...common}>
        <path
          d="M5 7h11M5 12h14M5 17h8M16 9l3 3-3 3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "verticalPadding") {
    return (
      <svg {...common}>
        <path
          d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "horizontalPadding") {
    return (
      <svg {...common}>
        <path
          d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "gap") {
    return (
      <svg {...common}>
        <rect
          x="5"
          y="5"
          width="5"
          height="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="14"
          y="14"
          width="5"
          height="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "typography") {
    return (
      <svg {...common}>
        <path
          d="M5 6h14M12 6v12M9 18h6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "timer") {
    return (
      <svg {...common}>
        <circle
          cx="12"
          cy="12"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M12 8v4l2.5 2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "duration") {
    return (
      <svg {...common}>
        <path
          d="M5 12h4l2-6 2 12 2-6h4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "iconSize") {
    return (
      <svg {...common}>
        <path
          d="M7 7h10v10H7zM4 10V4h6M20 14v6h-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4M8 12h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

// Submits the progress design fields as hidden inputs when the Progress panel is
// not shown, so saving never resets them to defaults.
export function ProgressHiddenInputs({ values }: { values: CampaignDesignValues }) {
  return (
    <>
      <input
        name="showProgressBar"
        type="hidden"
        value={String(values.showProgressBar)}
      />
      <input
        name="progressTarget"
        type="hidden"
        value={values.progressTarget}
      />
      <input
        name="progressBarStyle"
        type="hidden"
        value={values.progressBarStyle}
      />
      <input name="progressSteps" type="hidden" value={values.progressSteps} />
      <input
        name="progressHeight"
        type="hidden"
        value={values.progressHeight}
      />
      <input
        name="progressRadius"
        type="hidden"
        value={values.progressRadius}
      />
      <input
        name="progressTrackColor"
        type="hidden"
        value={values.progressTrackColor}
      />
      <input
        name="progressFillColor"
        type="hidden"
        value={values.progressFillColor}
      />
      <input
        name="progressTextColor"
        type="hidden"
        value={values.progressTextColor}
      />
      <input
        name="progressEffect"
        type="hidden"
        value={values.progressEffect}
      />
      <input
        name="progressShowLabel"
        type="hidden"
        value={String(values.progressShowLabel)}
      />
    </>
  );
}

export type MissingElement = { label: string; onAdd: () => void };

export function DesignPanel({
  title,
  children,
  missingElements,
}: {
  title: string;
  children: ReactNode;
  // Structural elements this panel configures that are NOT present in the
  // hand-edited HTML. When non-empty the panel is disabled and offers to add
  // each missing element back.
  missingElements?: MissingElement[] | null;
}) {
  const missing = missingElements ?? [];
  const isDisabled = missing.length > 0;
  // When a panel filter is active (the visual inspector reuses a single panel in
  // its modal), only the requested panels render.
  const panelFilter = useContext(DesignPanelFilterContext);
  if (panelFilter && !panelFilter.has(title)) return null;

  return (
    <section
      className={
        isDisabled
          ? "counterpulse-design-card counterpulse-design-card--disabled"
          : "counterpulse-design-card"
      }
    >
      <h3>
        <DesignSectionIcon title={title} />
        <span>{title}</span>
      </h3>
      {isDisabled && (
        <div className="counterpulse-design-card__missing" role="note">
          <p>
            {missing.length > 1 ? "These elements aren’t" : "The "}
            {missing.length === 1 && <strong>{missing[0].label}</strong>}
            {missing.length === 1
              ? " element isn’t"
              : ` (${missing.map((m) => m.label).join(", ")})`}{" "}
            in your campaign HTML, so these settings have no effect. Add{" "}
            {missing.length > 1 ? "them" : "it"} to the HTML to use these
            controls.
          </p>
          <div className="counterpulse-design-card__missing-actions">
            {missing.map((element) => (
              <button
                key={element.label}
                className="counterpulse-button-secondary"
                type="button"
                onClick={element.onAdd}
              >
                Add {element.label} to HTML
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="counterpulse-design-card__body">{children}</div>
    </section>
  );
}

// A single structural element (Icon, Button, Close button). When present it
// shows its settings plus a "remove" action; when absent it shows an empty
// state that adds it back. Replaces per-element show/hide checkboxes with the
// same "add/remove the HTML" model used across the editor. `canManage` is false
// inside the visual inspector (no add/remove there — just the settings).
export function ElementPanel({
  title,
  present,
  canManage,
  emptyText,
  addLabel,
  removeLabel,
  onAdd,
  onRemove,
  children,
}: {
  title: string;
  present: boolean;
  canManage: boolean;
  emptyText: string;
  addLabel: string;
  removeLabel: string;
  onAdd: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const panelFilter = useContext(DesignPanelFilterContext);
  if (panelFilter && !panelFilter.has(title)) return null;

  const showSettings = present || !canManage;

  return (
    <section className="counterpulse-design-card">
      <h3>
        <DesignSectionIcon title={title} />
        <span>{title}</span>
      </h3>
      <div className="counterpulse-design-card__body">
        {showSettings ? (
          <>
            {children}
            {canManage && (
              <div className="counterpulse-element-panel__actions">
                <button
                  className="counterpulse-button-secondary counterpulse-element-panel__remove"
                  type="button"
                  onClick={onRemove}
                >
                  {removeLabel}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="counterpulse-element-panel__empty" role="note">
            <p>{emptyText}</p>
            <button
              className="counterpulse-button-secondary"
              type="button"
              onClick={onAdd}
            >
              {addLabel}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export const designSectionIconPaths: Record<string, ReactNode> = {
  Template: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  Typography: (
    <>
      <path d="M5 18 10 6l5 12" />
      <path d="M6.7 14h6.6" />
      <path d="M16 18h3.5" />
    </>
  ),
  "Timer Style": (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 9.5V13l2.4 1.6" />
      <path d="M9.5 3h5" />
    </>
  ),
  Card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
    </>
  ),
  Progress: (
    <>
      <rect x="3" y="9.5" width="18" height="5" rx="2.5" />
      <path d="M3 12h11" />
    </>
  ),
  Elements: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <circle cx="17" cy="7" r="4" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
      <path d="M3 17h8" />
    </>
  ),
  Behavior: (
    <>
      <path d="M5 4l5.5 15 2.2-6.3 6.3-2.2z" />
      <path d="M13.5 13.5 19 19" />
    </>
  ),
  Motion: (
    <>
      <path d="M3 8h10" />
      <path d="M3 12h7" />
      <path d="M3 16h12" />
      <path d="M16 6l5 6-5 6" />
    </>
  ),
  Advanced: (
    <>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  "Offer code": (
    <>
      <path d="M4 12.2 12.2 4H20v7.8L11.8 20z" />
      <circle cx="16.5" cy="7.5" r="1.2" />
    </>
  ),
  Default: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
};

export function DesignSectionIcon({ title }: { title: string }) {
  const paths = designSectionIconPaths[title] ?? designSectionIconPaths.Default;

  return (
    <svg
      className="counterpulse-design-card__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}

export async function pickAndResolveShopifyFile(usage: "background" | "icon") {
  const fileId = await pickShopifyFile(usage);

  if (!fileId) return null;

  return resolveShopifyFileWithDirectApi(fileId, usage);
}

async function pickShopifyFile(usage: "background" | "icon") {
  const invoke = window.shopify?.intents?.invoke;

  if (!invoke) {
    throw new Error(
      "Shopify file picker is not available in this admin session.",
    );
  }

  const activity = await invoke("pick:shopify/File", {
    data: {
      mediaTypes:
        usage === "icon" ? ["MediaImage", "GenericFile"] : ["MediaImage"],
      multiSelect: false,
    },
  });
  const response = await activity.complete;

  if (response.code === "closed") return null;

  if (response.code === "error") {
    throw new Error(response.message || "Shopify file picker failed.");
  }

  const ids = Array.isArray(response.data?.ids) ? response.data.ids : [];
  const fileId = ids.find((id): id is string => typeof id === "string");

  if (!fileId) {
    throw new Error("Shopify did not return a selected file ID.");
  }

  return fileId;
}

async function resolveShopifyFileWithDirectApi(
  fileId: string,
  usage: "background" | "icon",
) {
  const response = await fetch("shopify:admin/api/graphql.json", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `#graphql
        query PromoPulseDesignFile($id: ID!) {
          node(id: $id) {
            __typename
            ... on MediaImage {
              id
              alt
              image {
                url
                altText
                width
                height
              }
              preview {
                image {
                  url
                }
              }
            }
            ... on GenericFile {
              id
              alt
              mimeType
              url
              preview {
                image {
                  url
                }
              }
            }
          }
        }`,
      variables: { id: fileId },
    }),
  });
  const payload = await readShopifyJson<ShopifyDesignFileResponse>(response);

  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Selected Shopify file could not load.",
    );
  }

  const option = readShopifyDesignFileOption(payload.data?.node, usage);

  if (!option) {
    throw new Error("Choose a supported Shopify image file.");
  }

  return option;
}

export function getPickerErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shopify file picker could not be opened.";
}

export type ShopifyDesignFileNode = {
  __typename?: string;
  id?: string | null;
  alt?: string | null;
  mimeType?: string | null;
  url?: string | null;
  image?: {
    url?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  preview?: {
    image?: {
      url?: string | null;
    } | null;
  } | null;
};

export type ShopifyDesignFileResponse = {
  data?: {
    node?: ShopifyDesignFileNode | null;
  };
  errors?: Array<{ message?: string }>;
};

async function readShopifyJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      "Shopify did not return file data. Confirm Direct API Access is enabled and redeploy the app configuration.",
    );
  }
}

export function readShopifyDesignFileOption(
  node: ShopifyDesignFileNode | null | undefined,
  usage: "background" | "icon",
): CampaignDesignImageOption | null {
  const id = node?.id?.trim() ?? "";
  const mimeType = node?.mimeType?.trim().toLowerCase() ?? "";
  const mediaImageUrl = node?.image?.url?.trim() ?? "";
  const genericFileUrl = node?.url?.trim() ?? "";
  const url = mediaImageUrl || genericFileUrl;
  const previewUrl = node?.preview?.image?.url?.trim() || url;
  const alt = node?.image?.altText?.trim() || node?.alt?.trim() || "";
  const label =
    alt ||
    buildShopifyImageLabel(node?.image?.width, node?.image?.height) ||
    "Shopify image";

  if (!id || !isSafeImageUrl(url)) return null;

  if (
    usage === "icon" &&
    node?.__typename === "GenericFile" &&
    !isSupportedIconMimeType(mimeType)
  ) {
    return null;
  }

  return {
    id,
    label,
    url,
    previewUrl: isSafeImageUrl(previewUrl) ? previewUrl : url,
    ...(alt ? { alt } : {}),
  };
}

export function isSupportedIconMimeType(mimeType: string) {
  return ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"].includes(
    mimeType,
  );
}

export function buildShopifyImageLabel(width?: number | null, height?: number | null) {
  if (!width || !height) return "";
  return `${width}x${height}`;
}

export function isSafeImageUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

export function DesignGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="counterpulse-form-field counterpulse-design-control-field">
      <span className="counterpulse-card-field__label">
        <span className="counterpulse-design-field-title">{label}</span>
      </span>
      {children}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </div>
  );
}

export function DesignField({
  label,
  error,
  children,
}: {
  label: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="counterpulse-form-field counterpulse-design-control-field">
      <span className="counterpulse-card-field__label">
        <span className="counterpulse-design-field-title">{label}</span>
      </span>
      {children}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
  );
}

export function ColorField({
  name,
  label,
  value,
  error,
  onChange,
}: {
  name: ColorDesignKey;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <DesignField label={label} error={error}>
      <span className="counterpulse-card-color-control counterpulse-design-color-control">
        <span className="counterpulse-card-color-control__swatch">
          <input
            aria-label={`${label} color picker`}
            type="color"
            value={isHexColor(value) ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
          />
        </span>
        <input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span
          className="counterpulse-card-color-control__picker"
          aria-hidden="true"
        >
          <CardControlIcon kind="eyedropper" />
        </span>
      </span>
    </DesignField>
  );
}

export function NumberField({
  name,
  label,
  value,
  error,
  min,
  max,
  onChange,
}: {
  name: NumberDesignKey;
  label: string;
  value: number;
  error?: string;
  min: number;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <DesignField label={label} error={error}>
      <span className="counterpulse-card-number-control counterpulse-design-number-control">
        <span
          className="counterpulse-card-number-control__icon"
          aria-hidden="true"
        >
          <CardControlIcon kind={getNumberFieldIcon(name)} />
        </span>
        <input
          {...(typeof max === "number" ? { max } : {})}
          min={min}
          name={name}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="counterpulse-card-number-control__unit">
          {getNumberFieldUnit(name)}
        </span>
      </span>
    </DesignField>
  );
}

export function getNumberFieldIcon(name: NumberDesignKey): CardControlIconKind {
  if (
    name === "titleFontSize" ||
    name === "subheadingFontSize" ||
    name === "legendFontSize" ||
    name === "timerNumberFontSize" ||
    name === "timerLabelFontSize" ||
    name === "offerCodeFontSize"
  ) {
    return "typography";
  }

  if (name === "timerFontSize") return "timer";
  if (name === "timerSurfaceRadius" || name === "offerCodeBorderRadius") {
    return "radius";
  }
  if (name === "timerSurfaceBorderSize") return "borderSize";
  if (name === "animationDurationMs" || name === "timerTickDurationMs") {
    return "duration";
  }
  if (name === "iconSize") return "iconSize";
  if (
    name === "contentGap" ||
    name === "offerCodeGap" ||
    name === "timerGap" ||
    name === "timerUnitGap"
  )
    return "gap";
  if (name === "contentMaxWidth") return "maxWidth";
  if (
    name === "paddingBlock" ||
    name === "offerCodePaddingBlock" ||
    name === "timerPaddingBlock"
  ) {
    return "verticalPadding";
  }
  if (
    name === "paddingInline" ||
    name === "offerCodePaddingInline" ||
    name === "timerPaddingInline"
  ) {
    return "horizontalPadding";
  }

  return "maxWidth";
}

export function getNumberFieldUnit(name: NumberDesignKey) {
  if (name === "animationDurationMs" || name === "timerTickDurationMs") {
    return "ms";
  }

  return "px";
}

export function ToggleSwitch({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="counterpulse-switch">
      <input
        aria-label={label}
        checked={checked}
        name={name}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true" />
    </label>
  );
}

export function ToggleField({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="counterpulse-toggle">
      <input
        checked={checked}
        name={name}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function TimerStyleHiddenInputs({ values }: { values: CampaignDesignValues }) {
  return (
    <>
      <input name="timerFormat" type="hidden" value={values.timerFormat} />
      <input
        name="timerShowLabels"
        type="hidden"
        value={String(values.timerShowLabels)}
      />
      <input
        name="timerShowSeconds"
        type="hidden"
        value={String(values.timerShowSeconds)}
      />
      <input
        name="timerHideZeroDays"
        type="hidden"
        value={String(values.timerHideZeroDays)}
      />
      <input
        name="timerDaysLabel"
        type="hidden"
        value={values.timerDaysLabel}
      />
      <input
        name="timerHoursLabel"
        type="hidden"
        value={values.timerHoursLabel}
      />
      <input
        name="timerMinutesLabel"
        type="hidden"
        value={values.timerMinutesLabel}
      />
      <input
        name="timerSecondsLabel"
        type="hidden"
        value={values.timerSecondsLabel}
      />
      <input name="timerStyle" type="hidden" value={values.timerStyle} />
      <input name="timerColor" type="hidden" value={values.timerColor} />
      <input name="timerFontSize" type="hidden" value={values.timerFontSize} />
      <input name="legendColor" type="hidden" value={values.legendColor} />
      <input
        name="legendFontSize"
        type="hidden"
        value={values.legendFontSize}
      />
      <input
        name="timerSurfaceColor"
        type="hidden"
        value={values.timerSurfaceColor}
      />
      <input
        name="timerSurfaceBorderColor"
        type="hidden"
        value={values.timerSurfaceBorderColor}
      />
      <input
        name="timerSurfaceBorderSize"
        type="hidden"
        value={values.timerSurfaceBorderSize}
      />
      <input
        name="timerSurfaceRadius"
        type="hidden"
        value={values.timerSurfaceRadius}
      />
    </>
  );
}

export function LayoutPreview({ layout }: { layout: CampaignDesignValues["layout"] }) {
  return (
    <span
      className={`counterpulse-layout-preview counterpulse-layout-preview--${layout.toLowerCase()}`}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  );
}

export function TimerStylePreview({
  timerStyle,
  timerFormat = "UNITS",
}: {
  timerStyle: CampaignDesignValues["timerStyle"];
  timerFormat?: CampaignDesignValues["timerFormat"];
}) {
  const isColonBoxes = timerFormat === "COLON" && timerStyle === "BOXES";

  return (
    <span
      className={[
        "counterpulse-timer-style-preview",
        `counterpulse-timer-style-preview--${timerStyle.toLowerCase()}`,
        `counterpulse-timer-style-preview--${timerFormat.toLowerCase()}`,
        isColonBoxes ? "counterpulse-timer-style-preview--colon-boxes" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {isColonBoxes ? (
        <>
          <span>01</span>
          <em>:</em>
          <span>58</span>
          <em>:</em>
          <span>26</span>
        </>
      ) : timerFormat === "COLON" ? (
        <span>01:58:26</span>
      ) : (
        <>
          <span>01</span>
          <span>58</span>
          <span>26</span>
        </>
      )}
    </span>
  );
}

export function EditIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="m5 16.8-.7 2.9 2.9-.7L17.9 8.3 15.7 6.1 5 16.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m14.6 7.2 2.2 2.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

