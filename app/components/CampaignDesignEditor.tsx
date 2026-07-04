import { useEffect, useMemo, useRef, useState } from "react";
import { AppAlert, InfoModal } from "./Notifications";

import { DesignControls } from "./DesignControls";
import { InspectorOverlay } from "./campaign-inspector/InspectorOverlay";
import { ComponentInspectorModal } from "./campaign-inspector/ComponentInspectorModal";
import { resolveInspectorComponent } from "./campaign-inspector/component-registry";
import {
  CampaignPreviewPanel,
  type PreviewPlacement,
} from "./CampaignPreviewPanel";
import { DevicePreviewToggle, type PreviewDevice } from "./DevicePreviewToggle";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";
import type {
  CampaignDesignErrors,
  CampaignDesignMediaOptions,
  CampaignDesignValues,
} from "../types/campaign-design";
import { emptyCampaignDesignMediaOptions } from "../types/campaign-design";
import type { FreeShippingProgressStyleValue } from "../types/free-shipping";
import type { CampaignViewModel } from "../utils/campaign-view-model";
import { deriveMobileDesignFromDesktop } from "../utils/responsive-design";
import {
  buildCampaignStructureTree,
  buildStructureCss,
  deriveCampaignStructureSpec,
  getNodeAtPath,
  getNodeSlot,
  htmlToTree,
  setNodeAttrAtPath,
  setNodeStyleAtPath,
  treeToHtml,
  type StructureNode,
} from "../utils/campaign-structure";
import type { CustomMessage } from "../utils/custom-messages";

type CampaignDesignEditorProps = {
  design: CampaignDesignValues;
  designMediaOptions?: CampaignDesignMediaOptions;
  errors?: CampaignDesignErrors;
  isProPlan: boolean;
  lockedCustomCssReason?: string;
  mobileDesign: CampaignDesignValues;
  // Custom-message snippets so the preview can fill data-cp-slot="custom-<id>".
  customMessages?: CustomMessage[];
  progressStyle?: FreeShippingProgressStyleValue;
  onChange: (design: CampaignDesignValues) => void;
  onMobileChange: (design: CampaignDesignValues) => void;
  onProgressStyleChange?: (value: FreeShippingProgressStyleValue) => void;
  viewModel: CampaignViewModel;
  structureEdited?: boolean;
  structureHtml?: string;
  structureCss?: string;
  mobileStructureEdited?: boolean;
  mobileStructureHtml?: string;
  mobileStructureCss?: string;
  // Bumped by the parent on discard so the structure surfaces reset to saved.
  resetSignal?: number;
  // Reports whether the structural HTML/CSS overrides differ from saved, to drive
  // the contextual save bar.
  onStructureDirtyChange?: (dirty: boolean) => void;
  // Reports the current structural HTML/CSS overrides so the host can include
  // them in the saved form (the edit page lifts them into the campaign form).
  onStructureChange?: (payload: StructureFormPayload) => void;
  // Switches the editor to the Campaign → Schedule section (timer progress).
  onGoToSchedule?: () => void;
};

export type StructureFormPayload = {
  structureEdited: boolean;
  structureHtml: string;
  structureCss: string;
  mobileStructureEdited: boolean;
  mobileStructureHtml: string;
  mobileStructureCss: string;
};

export function CampaignDesignEditor({
  design,
  designMediaOptions = emptyCampaignDesignMediaOptions,
  errors,
  isProPlan,
  lockedCustomCssReason,
  mobileDesign,
  customMessages = [],
  progressStyle,
  onChange,
  onMobileChange,
  onProgressStyleChange,
  viewModel,
  structureEdited: initialStructureEdited = false,
  structureHtml: initialStructureHtml = "",
  structureCss: initialStructureCss = "",
  mobileStructureEdited: initialMobileStructureEdited = false,
  mobileStructureHtml: initialMobileStructureHtml = "",
  mobileStructureCss: initialMobileStructureCss = "",
  resetSignal = 0,
  onStructureDirtyChange,
  onStructureChange,
  onGoToSchedule,
}: CampaignDesignEditorProps) {
  const actualPlacements = useMemo(
    () =>
      Array.from(
        new Set(
          viewModel.placements.map((placement) =>
            toPreviewPlacementFromCampaign(placement, viewModel.type),
          ),
        ),
      ),
    [viewModel.placements, viewModel.type],
  );
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [placementOverride, setPlacementOverride] = useState<{
    key: string;
    placement: PreviewPlacement;
  } | null>(null);
  const actualPlacementKey = actualPlacements.join("|");
  const primaryPlacement = actualPlacements[0] ?? "PRODUCT_PAGE";
  const placement =
    placementOverride?.key === actualPlacementKey
      ? placementOverride.placement
      : primaryPlacement;
  const sharedMobileDesign = useMemo(
    () => deriveMobileDesignFromDesktop(design),
    [design],
  );
  const previewMobileDesign = design.separateMobileDesign
    ? toSeparateMobileDesign(mobileDesign)
    : sharedMobileDesign;
  const activeDesign =
    device === "mobile" && design.separateMobileDesign
      ? previewMobileDesign
      : design;
  const updateDesktopDesign = (nextDesign: CampaignDesignValues) => {
    const normalizedDesign = {
      ...nextDesign,
      separateMobileDesign: design.separateMobileDesign,
    };

    onChange(normalizedDesign);

    if (!normalizedDesign.separateMobileDesign) {
      onMobileChange(deriveMobileDesignFromDesktop(normalizedDesign));
    }
  };
  const updateMobileDesign = (nextDesign: CampaignDesignValues) => {
    onMobileChange(toSeparateMobileDesign(nextDesign));
  };
  const updateActiveDesign =
    device === "mobile" && design.separateMobileDesign
      ? updateMobileDesign
      : updateDesktopDesign;
  const designErrorSummary = useMemo(
    () => buildDesignErrorSummary(errors),
    [errors],
  );
  const [openErrorModalKey, setOpenErrorModalKey] = useState("");

  // Structure modals. The HTML + CSS are auto-generated from the visual settings;
  // when the merchant (or the AI) edits either, they become the saved structure
  // override so both can be customized independently. Desktop and mobile keep
  // separate overrides so the mobile HTML can differ when "Separate desktop and
  // mobile" is on.
  const [htmlModalOpen, setHtmlModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [inspectEnabled, setInspectEnabled] = useState(true);
  const [inspectedPath, setInspectedPath] = useState<string | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const [cssModalOpen, setCssModalOpen] = useState(false);
  const desktopSurface = useStructureSurface(
    viewModel,
    design,
    primaryPlacement,
    {
      edited: initialStructureEdited,
      html: initialStructureHtml,
      css: initialStructureCss,
    },
    resetSignal,
  );
  const mobileSurface = useStructureSurface(
    viewModel,
    previewMobileDesign,
    primaryPlacement,
    {
      edited: initialMobileStructureEdited,
      html: initialMobileStructureHtml,
      css: initialMobileStructureCss,
    },
    resetSignal,
  );
  const isMobileSurface = device === "mobile" && design.separateMobileDesign;
  const activeSurface = isMobileSurface ? mobileSurface : desktopSurface;
  const surfaceLabel = isMobileSurface ? "mobile" : "desktop";

  // Report structure dirtiness (any override differs from saved) to the save bar.
  useEffect(() => {
    const dirty =
      desktopSurface.dirty ||
      (design.separateMobileDesign && mobileSurface.dirty);
    onStructureDirtyChange?.(dirty);
  }, [
    desktopSurface.dirty,
    mobileSurface.dirty,
    design.separateMobileDesign,
    onStructureDirtyChange,
  ]);

  // Report the current structure overrides so the host can persist them with the
  // campaign form (matches the structure* hidden inputs rendered below).
  const separate = design.separateMobileDesign;
  useEffect(() => {
    onStructureChange?.({
      structureEdited: desktopSurface.edited,
      structureHtml: desktopSurface.edited ? desktopSurface.displayedHtml : "",
      structureCss: desktopSurface.edited ? desktopSurface.displayedCss : "",
      mobileStructureEdited: separate && mobileSurface.edited,
      mobileStructureHtml:
        separate && mobileSurface.edited ? mobileSurface.displayedHtml : "",
      mobileStructureCss:
        separate && mobileSurface.edited ? mobileSurface.displayedCss : "",
    });
  }, [
    desktopSurface.edited,
    desktopSurface.displayedHtml,
    desktopSurface.displayedCss,
    mobileSurface.edited,
    mobileSurface.displayedHtml,
    mobileSurface.displayedCss,
    separate,
    onStructureChange,
  ]);
  const previewViewModel = useMemo(
    () => ({
      ...viewModel,
      design: device === "mobile" ? previewMobileDesign : design,
    }),
    [design, device, previewMobileDesign, viewModel],
  );
  const updateSeparateMobileDesign = (checked: boolean) => {
    const nextDesign = {
      ...design,
      separateMobileDesign: checked,
    };

    onChange(nextDesign);

    if (checked) {
      onMobileChange(
        toSeparateMobileDesign(
          mobileDesign.separateMobileDesign ? mobileDesign : sharedMobileDesign,
        ),
      );
    } else {
      onMobileChange(deriveMobileDesignFromDesktop(nextDesign));
    }
  };
  const selectPreviewPlacement = (nextPlacement: PreviewPlacement) => {
    setPlacementOverride({
      key: actualPlacementKey,
      placement: nextPlacement,
    });
  };
  const closeErrorModal = () => {
    const targetField = designErrorSummary?.field;

    setOpenErrorModalKey("");
    window.setTimeout(() => focusDesignErrorField(targetField), 0);
  };
  const saveAnyway = () => {
    setOpenErrorModalKey("");
    requestForcedDesignSave();
  };

  useEffect(() => {
    if (!designErrorSummary) return;

    const openModal = window.setTimeout(() => {
      setOpenErrorModalKey(designErrorSummary.key);
    }, 0);

    return () => window.clearTimeout(openModal);
  }, [designErrorSummary]);

  // Props shared by the main DesignControls and the inspector modal's reused
  // panel, so the modal edits the exact same component settings (no duplication).
  const designControlsProps = {
    mediaOptions: designMediaOptions,
    errors,
    hasOffer: Boolean(previewViewModel.offer),
    hasTimer: isTimerShown(previewViewModel.timer),
    isProPlan,
    device: (device === "mobile" && design.separateMobileDesign
      ? "mobile"
      : "desktop") as "mobile" | "desktop",
    progressStyle,
    structureEdited: activeSurface.edited,
    values: activeDesign,
    presentSlots: activeSurface.presentSlots,
    onChange: updateActiveDesign,
    onAddSlot: activeSurface.addSlot,
    onGoToSchedule,
    onEditStructureCss: () => setCssModalOpen(true),
    onEditStructureHtml: () => setHtmlModalOpen(true),
    onProgressStyleChange,
    onResetStructure: activeSurface.reset,
  };

  // Resolve the inspected node + its component descriptor for the modal.
  const inspectedNode =
    inspectedPath != null && activeSurface.displayedTree
      ? getNodeAtPath(activeSurface.displayedTree, inspectedPath)
      : null;
  const inspectedComponent = inspectedNode
    ? resolveInspectorComponent(inspectedNode)
    : null;

  return (
    <s-section heading="Design & Preview">
      <InfoModal
        action={
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={saveAnyway}
          >
            Save anyway
          </button>
        }
        closeLabel="Review field"
        open={Boolean(designErrorSummary && openErrorModalKey)}
        title="Design could not be saved"
        onClose={closeErrorModal}
      >
        <p>{designErrorSummary?.message}</p>
      </InfoModal>

      {/* Hidden inputs so the structural HTML + CSS overrides travel with the
          design form. When not edited, they stay empty and the backend
          regenerates the structure from the visual settings. Desktop and mobile
          submit independently; the backend only stores the mobile structure when
          it differs from desktop. */}
      <input
        name="structureEdited"
        type="hidden"
        value={desktopSurface.edited ? "true" : "false"}
      />
      <input
        name="structureHtml"
        type="hidden"
        value={desktopSurface.edited ? desktopSurface.displayedHtml : ""}
      />
      <input
        name="structureCss"
        type="hidden"
        value={desktopSurface.edited ? desktopSurface.displayedCss : ""}
      />
      <input
        name="mobileStructureEdited"
        type="hidden"
        value={
          design.separateMobileDesign && mobileSurface.edited ? "true" : "false"
        }
      />
      <input
        name="mobileStructureHtml"
        type="hidden"
        value={
          design.separateMobileDesign && mobileSurface.edited
            ? mobileSurface.displayedHtml
            : ""
        }
      />
      <input
        name="mobileStructureCss"
        type="hidden"
        value={
          design.separateMobileDesign && mobileSurface.edited
            ? mobileSurface.displayedCss
            : ""
        }
      />

      <StructureCodeModal
        description={`The structural HTML below is what renders the ${surfaceLabel} campaign on your storefront. Styling lives separately in the CSS editor, so this stays clean. Edit it to customize the structure; reset to regenerate it from the design settings.`}
        edited={activeSurface.edited}
        open={htmlModalOpen}
        title={`Campaign HTML structure (${surfaceLabel})`}
        value={activeSurface.displayedHtml}
        onChange={activeSurface.changeHtml}
        onClose={() => setHtmlModalOpen(false)}
        onInfo={() => setHelpOpen(true)}
        onReset={activeSurface.reset}
      />

      <StructureHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <StructureCodeModal
        description="These are the styles applied to the campaign. The __CP_SCOPE__ placeholder is replaced with this campaign's unique scope at render time — keep it on the variable block. Edit to customize the styles; reset to regenerate them from the design settings."
        edited={activeSurface.edited}
        open={cssModalOpen}
        title={`Campaign CSS (${surfaceLabel})`}
        value={activeSurface.displayedCss}
        onChange={activeSurface.changeCss}
        onClose={() => setCssModalOpen(false)}
        onReset={activeSurface.reset}
      />

      {errors?.form && (
        <AppAlert tone="critical" title="Design could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {lockedCustomCssReason && (
        <PlanUpgradeCallout
          message={lockedCustomCssReason}
          title="Custom CSS is locked"
        />
      )}

      <div className="counterpulse-design-editor">
        <div className="counterpulse-design-editor__controls">
          <section className="counterpulse-design-card">
            <h3>Responsive design</h3>
            <div className="counterpulse-design-card__body">
              {design.separateMobileDesign ? (
                <DevicePreviewToggle value={device} onChange={setDevice} />
              ) : null}
              <div className="counterpulse-responsive-design-switch">
                <div>
                  <strong>Separate desktop and mobile</strong>
                  <span>
                    {design.separateMobileDesign
                      ? "Mobile has its own editable design values."
                      : "Mobile inherits desktop styling with slightly smaller text."}
                  </span>
                </div>
                <label className="counterpulse-switch">
                  <input
                    aria-label="Separate desktop and mobile design"
                    checked={design.separateMobileDesign}
                    name="separateMobileDesign"
                    type="checkbox"
                    onChange={(event) =>
                      updateSeparateMobileDesign(event.target.checked)
                    }
                  />
                  <span aria-hidden="true" />
                </label>
              </div>
              <p className="counterpulse-design-note">
                {design.separateMobileDesign
                  ? `You are editing the ${device} design. Switching device changes which campaign design is edited.`
                  : "You are editing one shared design. Use Mobile preview to verify the automatic typography adjustment."}
              </p>
            </div>
          </section>

          <DesignControls {...designControlsProps} />
        </div>

        <div
          className="counterpulse-design-editor__preview-host"
          ref={previewHostRef}
        >
          <CampaignPreviewPanel
            actualPlacements={actualPlacements}
            ariaLabel="Design live campaign preview"
            className="counterpulse-design-editor__preview"
            design={design}
            device={device}
            mobileDesign={previewMobileDesign}
            mobileStructureTree={
              design.separateMobileDesign ? mobileSurface.displayedTree : null
            }
            mobileStructureCss={
              design.separateMobileDesign ? mobileSurface.displayedCss : ""
            }
            placement={placement}
            structureTree={desktopSurface.displayedTree}
            structureCss={desktopSurface.displayedCss}
            customMessages={customMessages}
            inspect={inspectEnabled}
            viewModel={previewViewModel}
            onDeviceChange={setDevice}
            onPlacementChange={selectPreviewPlacement}
          />
          <InspectorOverlay
            containerRef={previewHostRef}
            enabled={inspectEnabled}
            onSelect={setInspectedPath}
          />
          <label className="counterpulse-inspector-toggle">
            <input
              checked={inspectEnabled}
              type="checkbox"
              onChange={(event) => setInspectEnabled(event.target.checked)}
            />
            <span>Inspect</span>
          </label>
        </div>
      </div>

      {inspectedComponent && (
        <ComponentInspectorModal
          component={inspectedComponent}
          isRoot={inspectedPath === ""}
          nodeStyle={inspectedNode?.attrs?.style}
          isImage={inspectedNode?.tag === "img"}
          imageSrc={inspectedNode?.attrs?.src ?? ""}
          imageAlt={inspectedNode?.attrs?.alt ?? ""}
          renderPanel={(panelTitle) => (
            <DesignControls
              {...designControlsProps}
              presentSlots={null}
              panelFilter={new Set([panelTitle])}
            />
          )}
          onApplyCommon={(declarations) => {
            if (inspectedPath != null) {
              activeSurface.updateNodeStyle(inspectedPath, declarations);
            }
          }}
          onChangeAttr={(name, value) => {
            if (inspectedPath != null) {
              activeSurface.updateNodeAttr(inspectedPath, name, value);
            }
          }}
          onClose={() => setInspectedPath(null)}
        />
      )}
    </s-section>
  );
}

function StructureCodeModal({
  open,
  title,
  description,
  value,
  edited,
  onChange,
  onReset,
  onClose,
  onInfo,
}: {
  open: boolean;
  title: string;
  description: string;
  value: string;
  edited: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onClose: () => void;
  onInfo?: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="counterpulse-modal-backdrop">
      <button
        aria-label="Close"
        className="counterpulse-modal-backdrop__dismiss"
        tabIndex={-1}
        type="button"
        onClick={onClose}
      />
      <div
        aria-label={title}
        aria-modal="true"
        className="counterpulse-modal counterpulse-modal--html"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <div>
            <h2>
              {title}
              {onInfo && (
                <button
                  aria-label="Element reference"
                  className="counterpulse-info-icon-button"
                  type="button"
                  onClick={onInfo}
                >
                  <InfoCircleIcon />
                </button>
              )}
            </h2>
            <p className="counterpulse-design-note">{description}</p>
          </div>
        </div>
        <div className="counterpulse-modal__body">
          <textarea
            aria-label={title}
            className="counterpulse-structure-html-textarea"
            spellCheck={false}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <div className="counterpulse-modal__actions">
          <button
            className="counterpulse-button-secondary"
            disabled={!edited}
            type="button"
            onClick={onReset}
          >
            Reset from design
          </button>
          <button
            className="counterpulse-button"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCircleIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="18"
      height="18"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="8" r="1.3" fill="currentColor" />
      <path
        d="M12 11v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Reference shown by the info icon in the HTML modal: the slot elements, how each
// renders, and the HTML attributes it supports.
const STRUCTURE_ELEMENT_DOCS: Array<{
  example: string;
  renders: string;
  attributes: string;
}> = [
  {
    example: '<strong data-cp-slot="headline"></strong>',
    renders:
      "The headline message. Filled with the localized headline text (basic inline HTML like <b>/<span> allowed in the message settings).",
    attributes:
      "class, id, style, data-* — kept for styling/positioning. Leave the element empty; the text comes from settings.",
  },
  {
    example: '<span data-cp-slot="body"></span>',
    renders:
      "The supporting message line. Filled with the message that matches the campaign: the subheadline, or — depending on the type — the free-shipping empty-cart/success message, the low-stock message, or the delivery-cutoff message. Hidden automatically when there is no body text.",
    attributes: "class, id, style, data-*.",
  },
  {
    example: '<span data-cp-slot="cta"></span>  (or <a data-cp-slot="cta">)',
    renders:
      "The call-to-action button text. Use <a> to render a link (the storefront sets href automatically); <span> for a plain button. Hidden when the CTA is turned off.",
    attributes:
      "class, id, style, data-*. Tag <a> vs <span> controls link vs button.",
  },
  {
    example: '<span data-cp-slot="badge-text"></span>',
    renders:
      "The badge message text (product-badge campaigns). Filled with the badge text from settings (falls back to the headline when no badge text is set).",
    attributes: "class, id, style, data-*.",
  },
  {
    example: '<span data-cp-slot="icon"></span>',
    renders:
      "The campaign icon. By default uses the icon chosen in Design settings.",
    attributes:
      'class, id, style, data-*. data-cp-icon="FIRE|CLOCK|TRUCK|GIFT|TAG|STAR|BOLT|HEART|CART|PERCENT|BELL|ROCKET|CHECK" overrides the icon for this instance; data-cp-icon-size="24" sets its size in px.',
  },
  {
    example: '<div data-cp-slot="timer"></div>',
    renders:
      "The full live countdown — it already draws the digits AND the separators/labels per the timer Design settings (style PLAIN/GROUPED/BOXES + format COLON/labels). Do NOT add your own ':' or unit labels around it; choose the look in Design settings instead. When the timer expires it shows the expired message (expiredText) in its place.",
    attributes:
      'class, id, style, data-*. data-cp-compact="true" forces the compact one-line timer; "false" forces the full timer. Use data-cp-slot="timer-inline" inside the copy block for an inline compact timer.',
  },
  {
    example: '<span data-cp-slot="offer"></span>',
    renders:
      "The discount code area (code, copy button, apply button) per the Discount + Design settings. Hidden when there is no offer.",
    attributes: "class, id, style, data-*.",
  },
  {
    example: '<span data-cp-slot="close"></span>',
    renders:
      "The dismiss (X) button. Shown only when 'Show close button' is on in Design settings.",
    attributes: "class, id, style, data-*.",
  },
  {
    example: '<div data-cp-slot="progress"></div>',
    renders:
      "The free-shipping progress bar. Shown only for free-shipping campaigns with the progress bar enabled.",
    attributes: "class, id, style, data-*.",
  },
  {
    example: '<div data-cp-slot="badge-timer"></div>',
    renders:
      "A compact countdown rendered inside a product badge (badge campaigns with a timer). Shown only when the badge campaign has a timer.",
    attributes: "class, id, style, data-*.",
  },
  {
    example:
      '<span data-cp-slot="timer-days"></span> (also -hours/-minutes/-seconds)',
    renders:
      "A SINGLE live countdown part — just the number, ticking every second. Place them anywhere and add your own separators/labels around them (e.g. a custom timer layout). Use these instead of the full timer slot when you need to position the parts yourself; don't mix both.",
    attributes: "class, id, style, data-*.",
  },
  {
    example: '<span data-cp-slot="custom-<id>"></span>',
    renders:
      "A custom reusable message you defined in the Message tab. Place it anywhere; it is filled with that message's text, with dynamic variables ({{time_left}}, {{remaining_amount}}, {{quantity}}, ...) interpolated. The Message tab generates the exact <id> and a copyable slot tag for each message.",
    attributes: "class, id, style, data-*.",
  },
];

function StructureHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="counterpulse-modal-backdrop">
      <button
        aria-label="Close"
        className="counterpulse-modal-backdrop__dismiss"
        tabIndex={-1}
        type="button"
        onClick={onClose}
      />
      <div
        aria-label="Campaign HTML element reference"
        aria-modal="true"
        className="counterpulse-modal counterpulse-modal--html"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <div>
            <h2>Element reference</h2>
            <p className="counterpulse-design-note">
              The HTML carries only the structure. Dynamic parts are empty{" "}
              <code>data-cp-slot</code> placeholders that the app fills at
              render time from your Design settings. Any other safe HTML (divs,
              headings, images, lists, classes, ids, data attributes) is
              rendered exactly as written. The message texts (headline, body,
              CTA, badge) render through their slots below; the supporting{" "}
              <code>body</code>
              slot automatically shows the message that matches the campaign and
              its state (subheadline, free-shipping, low-stock, or delivery). To
              place an extra text anywhere, create it in the Message tab and use
              its <code>custom-&lt;id&gt;</code> slot. You can also type dynamic
              variables like <code>{`{{remaining_amount}}`}</code> or{" "}
              <code>{`{{time_left}}`}</code> directly into any text in the HTML
              — see the Message tab for the full list — and they are replaced
              live. Below: each slot, how it renders, and the attributes it
              supports.
            </p>
          </div>
        </div>
        <div className="counterpulse-modal__body">
          <div className="counterpulse-structure-help">
            {STRUCTURE_ELEMENT_DOCS.map((doc) => (
              <div
                key={doc.example}
                className="counterpulse-structure-help__row"
              >
                <code>{doc.example}</code>
                <p>
                  <strong>Renders:</strong> {doc.renders}
                </p>
                <p>
                  <strong>Attributes:</strong> {doc.attributes}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="counterpulse-modal__actions">
          <button
            className="counterpulse-button"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

type StructureSurface = {
  edited: boolean;
  dirty: boolean;
  displayedHtml: string;
  displayedCss: string;
  tree: StructureNode | null;
  displayedTree: StructureNode | null;
  presentSlots: ReadonlySet<string> | null;
  reset: () => void;
  changeHtml: (value: string) => void;
  changeCss: (value: string) => void;
  addSlot: (slot: string) => void;
  updateNodeStyle: (path: string, declarations: Record<string, string>) => void;
  updateNodeAttr: (path: string, name: string, value: string) => void;
};

// Manages one structural-HTML override surface (desktop or mobile): the live
// auto-generated HTML/CSS, the merchant's edits, the parsed tree used to drive
// the live preview, and whether it differs from the saved value.
function useStructureSurface(
  viewModel: CampaignViewModel,
  designForSurface: CampaignDesignValues,
  placement: PreviewPlacement,
  init: { edited: boolean; html: string; css: string },
  resetSignal: number,
): StructureSurface {
  const generatedHtml = useMemo(
    () =>
      treeToHtml(
        buildCampaignStructureTree(
          deriveCampaignStructureSpec(
            viewModel,
            designForSurface,
            "block",
            placement,
          ),
        ),
      ),
    [viewModel, designForSurface, placement],
  );
  const generatedCss = useMemo(
    () => buildStructureCss(designForSurface),
    [designForSurface],
  );
  const [edited, setEdited] = useState(init.edited);
  const [html, setHtml] = useState(init.html || generatedHtml);
  const [css, setCss] = useState(init.css || generatedCss);

  // Re-seed the local state from the saved baseline when the parent discards
  // (resetSignal bumps) OR when a new saved value arrives from the server after a
  // save (loader revalidation changes init). The latter is what clears the
  // "Unsaved changes" bar once a save lands — the surface adopts the saved
  // (sanitized) HTML, so the derived `dirty` below recomputes to false.
  const initSignature = `${init.edited ? "1" : "0"}|${init.html}|${init.css}`;
  const lastSeed = useRef({ resetSignal, initSignature });
  useEffect(() => {
    if (
      resetSignal === lastSeed.current.resetSignal &&
      initSignature === lastSeed.current.initSignature
    ) {
      return;
    }
    lastSeed.current = { resetSignal, initSignature };
    setEdited(init.edited);
    setHtml(init.html || generatedHtml);
    setCss(init.css || generatedCss);
    // generatedHtml/generatedCss intentionally omitted from deps: they change as
    // the merchant tweaks visual settings and must NOT wipe an in-progress edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal, initSignature]);

  const displayedHtml = edited ? html : generatedHtml;
  const displayedCss = edited ? css : generatedCss;

  // Dirty is DERIVED from comparing the current override payload to the saved
  // baseline (init). This way it clears automatically once a save revalidates the
  // loader and the saved baseline matches the current value — no stale "Unsaved
  // changes" bar. HTML is normalized through the AST so formatting differences
  // (compact storage vs. pretty editor output) never count as a change.
  const normalizeHtml = (value: string) => {
    try {
      const parsed = htmlToTree(value);
      return parsed ? treeToHtml(parsed) : value;
    } catch {
      return value;
    }
  };
  const savedPayload = {
    edited: init.edited,
    html: init.edited ? normalizeHtml(init.html) : "",
    css: init.edited ? init.css : "",
  };
  const currentPayload = {
    edited,
    html: edited ? normalizeHtml(displayedHtml) : "",
    css: edited ? displayedCss : "",
  };
  const dirty =
    savedPayload.edited !== currentPayload.edited ||
    savedPayload.html !== currentPayload.html ||
    savedPayload.css !== currentPayload.css;

  const reset = () => {
    setEdited(false);
    setHtml(generatedHtml);
    setCss(generatedCss);
  };
  const changeHtml = (value: string) => {
    setHtml(value);
    setCss((current) => (edited ? current : generatedCss));
    setEdited(true);
  };
  const changeCss = (value: string) => {
    setCss(value);
    setHtml((current) => (edited ? current : generatedHtml));
    setEdited(true);
  };

  const tree = useMemo(
    () => (edited ? htmlToTree(displayedHtml) : null),
    [edited, displayedHtml],
  );

  // The parsed tree of whatever is currently shown (edited override OR generated
  // from settings). Always present, for the visual inspector.
  const displayedTree = useMemo(
    () => htmlToTree(displayedHtml),
    [displayedHtml],
  );

  // Slots present in the current HTML. null when not overridden (the structure is
  // auto-generated from settings, so every applicable element is available).
  const presentSlots = useMemo<ReadonlySet<string> | null>(() => {
    if (!edited) return null;
    const slots = new Set<string>();
    const walk = (n: StructureNode | null) => {
      if (!n) return;
      const slot = getNodeSlot(n);
      if (slot) slots.add(slot);
      n.children?.forEach(walk);
    };
    walk(tree);
    return slots;
  }, [edited, tree]);

  // Applies inline-style declarations to a node (by AST path) — the inspector's
  // common properties. Editing a generated structure turns it into an override.
  const updateNodeStyle = (
    path: string,
    declarations: Record<string, string>,
  ) => {
    const current = htmlToTree(displayedHtml);
    if (!current) return;
    const next = setNodeStyleAtPath(current, path, declarations);
    setHtml(treeToHtml(next));
    setCss((value) => (edited ? value : generatedCss));
    setEdited(true);
  };

  // Sets an attribute on a node (by AST path) — e.g. the inspector editing an
  // image src. Turns a generated structure into an override.
  const updateNodeAttr = (path: string, name: string, value: string) => {
    const current = htmlToTree(displayedHtml);
    if (!current) return;
    const next = setNodeAttrAtPath(current, path, name, value);
    setHtml(treeToHtml(next));
    setCss((value2) => (edited ? value2 : generatedCss));
    setEdited(true);
  };

  // Inserts a missing slot element into the edited HTML so its settings card
  // works again. Appends it to the surface root.
  const addSlot = (slot: string) => {
    const current = htmlToTree(displayedHtml);
    if (!current) return;
    const root = current.children ? current : { ...current, children: [] };
    root.children = [
      ...(root.children ?? []),
      { tag: SLOT_ELEMENT_TAG[slot] ?? "div", attrs: { "data-cp-slot": slot } },
    ];
    setHtml(treeToHtml(root));
    setEdited(true);
  };

  return {
    edited,
    dirty,
    displayedHtml,
    displayedCss,
    tree,
    displayedTree,
    presentSlots,
    reset,
    changeHtml,
    changeCss,
    addSlot,
    updateNodeStyle,
    updateNodeAttr,
  };
}

// Default element tag used when auto-adding a missing slot to the HTML.
const SLOT_ELEMENT_TAG: Record<string, string> = {
  headline: "strong",
  body: "span",
  cta: "span",
  icon: "span",
  timer: "div",
  "timer-inline": "div",
  offer: "span",
  close: "span",
  progress: "div",
};

function toSeparateMobileDesign(
  design: CampaignDesignValues,
): CampaignDesignValues {
  return {
    ...design,
    separateMobileDesign: true,
  };
}

const designErrorFieldOrder: Array<keyof CampaignDesignErrors> = [
  "layout",
  "templateKey",
  "backgroundType",
  "backgroundImageUrl",
  "backgroundImageSize",
  "backgroundImagePosition",
  "backgroundImageRepeat",
  "backgroundImageAttachment",
  "backgroundColor",
  "gradientStartColor",
  "gradientEndColor",
  "gradientAngle",
  "borderRadius",
  "borderSize",
  "borderColor",
  "alignment",
  "paddingBlock",
  "paddingInline",
  "contentGap",
  "contentMaxWidth",
  "fontFamily",
  "titleFontSize",
  "titleColor",
  "subheadingFontSize",
  "subheadingColor",
  "timerFontSize",
  "timerColor",
  "legendFontSize",
  "legendColor",
  "timerFormat",
  "timerStyle",
  "timerSurfaceColor",
  "timerSurfaceRadius",
  "timerSurfaceBorderSize",
  "timerSurfaceBorderColor",
  "icon",
  "customIconUrl",
  "iconSize",
  "accentColor",
  "buttonColor",
  "buttonTextColor",
  "closeButtonColor",
  "showDiscountCode",
  "showCopyCodeButton",
  "showApplyDiscountButton",
  "offerCodeLayout",
  "offerCodeLabel",
  "copyCodeLabel",
  "copiedCodeLabel",
  "applyDiscountLabel",
  "appliedDiscountMessage",
  "offerCodeTextColor",
  "offerCodeBackgroundColor",
  "offerCodeBorderColor",
  "offerCodeFontSize",
  "offerCodeBorderRadius",
  "offerCodePaddingBlock",
  "offerCodePaddingInline",
  "offerCodeGap",
  "offerCopyBehavior",
  "offerApplyBehavior",
  "positionMode",
  "entranceAnimation",
  "exitAnimation",
  "animationDurationMs",
  "timerTickAnimation",
  "timerTickDurationMs",
  "customCss",
];

function buildDesignErrorSummary(errors?: CampaignDesignErrors) {
  if (!errors) return null;

  const field = designErrorFieldOrder.find((key) => errors[key]);
  const message = field
    ? errors[field]
    : errors.form || Object.values(errors).find(Boolean);

  if (!message) return null;

  return {
    field,
    key: `${field ?? "form"}:${message}`,
    message,
  };
}

function focusDesignErrorField(field?: keyof CampaignDesignErrors) {
  const selector = field
    ? `[name="${field}"], [data-design-error-field="${field}"]`
    : ".counterpulse-design-editor__controls";
  const target = document.querySelector<HTMLElement>(selector);

  target?.scrollIntoView({ behavior: "smooth", block: "center" });

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLButtonElement
  ) {
    target.focus({ preventScroll: true });
  }
}

function requestForcedDesignSave() {
  const form =
    document.querySelector<HTMLFormElement>(
      ".counterpulse-editor-panel:not([hidden]) form[data-campaign-form]",
    ) ?? document.querySelector<HTMLFormElement>("form[data-campaign-form]");

  if (!form) return;

  const forceInput = ensureHiddenInput(form, "forceDesignSave");
  forceInput.value = "true";

  const actionInput = form.elements.namedItem("_action");
  if (actionInput instanceof HTMLInputElement && !actionInput.value) {
    actionInput.value = "saveDraft";
  }

  form.requestSubmit();
}

function ensureHiddenInput(form: HTMLFormElement, name: string) {
  const existing = form.elements.namedItem(name);

  if (existing instanceof HTMLInputElement) return existing;

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  form.appendChild(input);
  return input;
}

function isTimerShown(timer: CampaignViewModel["timer"]) {
  if (!timer) return false;
  if (timer.mode === "FIXED_DATE") return Boolean(timer.endsAt);

  return true;
}

function toPreviewPlacementFromCampaign(
  value: string,
  campaignType?: string,
): PreviewPlacement {
  if (campaignType === "PRODUCT_BADGE") return "PRODUCT_BADGE";
  if (value === "BOTTOM_BAR") return "BOTTOM_BAR";
  if (value === "PRODUCT_PAGE") return "PRODUCT_PAGE";
  if (value === "CART_PAGE") return "CART_PAGE";
  if (value === "CART_DRAWER") return "CART_DRAWER";
  if (value === "PRODUCT_PAGE_BADGE") return "PRODUCT_BADGE";
  if (value === "COLLECTION_CARD") return "PRODUCT_BADGE";
  if (value === "CUSTOM_SELECTOR") return "PRODUCT_PAGE";

  return "TOP_BAR";
}
