import { useEffect, useMemo, useState } from "react";
import { AppAlert, InfoModal } from "./Notifications";

import { DesignControls } from "./DesignControls";
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

type CampaignDesignEditorProps = {
  design: CampaignDesignValues;
  designMediaOptions?: CampaignDesignMediaOptions;
  errors?: CampaignDesignErrors;
  isProPlan: boolean;
  lockedCustomCssReason?: string;
  mobileDesign: CampaignDesignValues;
  progressStyle?: FreeShippingProgressStyleValue;
  onChange: (design: CampaignDesignValues) => void;
  onMobileChange: (design: CampaignDesignValues) => void;
  onProgressStyleChange?: (value: FreeShippingProgressStyleValue) => void;
  viewModel: CampaignViewModel;
};

export function CampaignDesignEditor({
  design,
  designMediaOptions = emptyCampaignDesignMediaOptions,
  errors,
  isProPlan,
  lockedCustomCssReason,
  mobileDesign,
  progressStyle,
  onChange,
  onMobileChange,
  onProgressStyleChange,
  viewModel,
}: CampaignDesignEditorProps) {
  const actualPlacements = useMemo(
    () =>
      Array.from(
        new Set(viewModel.placements.map(toPreviewPlacementFromCampaign)),
      ),
    [viewModel.placements],
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

  useEffect(() => {
    if (!designErrorSummary) return;

    const openModal = window.setTimeout(() => {
      setOpenErrorModalKey(designErrorSummary.key);
    }, 0);

    return () => window.clearTimeout(openModal);
  }, [designErrorSummary]);

  return (
    <s-section heading="Design & Preview">
      <InfoModal
        closeLabel="Review field"
        open={Boolean(designErrorSummary && openErrorModalKey)}
        title="Design could not be saved"
        onClose={closeErrorModal}
      >
        <p>{designErrorSummary?.message}</p>
      </InfoModal>

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

          <DesignControls
            mediaOptions={designMediaOptions}
            errors={errors}
            hasTimer={isTimerShown(previewViewModel.timer)}
            isProPlan={isProPlan}
            progressStyle={progressStyle}
            values={activeDesign}
            onChange={updateActiveDesign}
            onProgressStyleChange={onProgressStyleChange}
          />
        </div>

        <CampaignPreviewPanel
          actualPlacements={actualPlacements}
          className="counterpulse-design-editor__preview"
          design={design}
          device={device}
          mobileDesign={previewMobileDesign}
          placement={placement}
          viewModel={previewViewModel}
          onDeviceChange={setDevice}
          onPlacementChange={selectPreviewPlacement}
        />
      </div>
    </s-section>
  );
}

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
  "positionMode",
  "entranceAnimation",
  "exitAnimation",
  "animationDurationMs",
  "timerTickAnimation",
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

function isTimerShown(timer: CampaignViewModel["timer"]) {
  if (!timer) return false;
  if (timer.mode === "FIXED_DATE") return Boolean(timer.endsAt);

  return true;
}

function toPreviewPlacementFromCampaign(value: string): PreviewPlacement {
  if (value === "BOTTOM_BAR") return "BOTTOM_BAR";
  if (value === "PRODUCT_PAGE") return "PRODUCT_PAGE";
  if (value === "CART_PAGE") return "CART_PAGE";
  if (value === "CART_DRAWER") return "CART_DRAWER";
  if (value === "PRODUCT_PAGE_BADGE") return "PRODUCT_BADGE";
  if (value === "COLLECTION_CARD") return "PRODUCT_BADGE";
  if (value === "CUSTOM_SELECTOR") return "PRODUCT_PAGE";

  return "TOP_BAR";
}
