import { useMemo, useState } from "react";
import { AppAlert } from "./Notifications";

import { DesignControls } from "./DesignControls";
import {
  CampaignPreviewPanel,
  type PreviewPlacement,
} from "./CampaignPreviewPanel";
import {
  DevicePreviewToggle,
  type PreviewDevice,
} from "./DevicePreviewToggle";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";
import type {
  CampaignDesignErrors,
  CampaignDesignMediaOptions,
  CampaignDesignValues,
} from "../types/campaign-design";
import { emptyCampaignDesignMediaOptions } from "../types/campaign-design";
import type { CampaignViewModel } from "../utils/campaign-view-model";

type CampaignDesignEditorProps = {
  design: CampaignDesignValues;
  designMediaOptions?: CampaignDesignMediaOptions;
  errors?: CampaignDesignErrors;
  isProPlan: boolean;
  lockedCustomCssReason?: string;
  mobileDesign: CampaignDesignValues;
  onChange: (design: CampaignDesignValues) => void;
  onMobileChange: (design: CampaignDesignValues) => void;
  viewModel: CampaignViewModel;
};

export function CampaignDesignEditor({
  design,
  designMediaOptions = emptyCampaignDesignMediaOptions,
  errors,
  isProPlan,
  lockedCustomCssReason,
  mobileDesign,
  onChange,
  onMobileChange,
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
  const activeDesign = device === "mobile" ? mobileDesign : design;
  const updateActiveDesign =
    device === "mobile" ? onMobileChange : onChange;
  const previewViewModel = useMemo(
    () => ({
      ...viewModel,
      design: activeDesign,
    }),
    [activeDesign, viewModel],
  );
  const selectPreviewPlacement = (nextPlacement: PreviewPlacement) => {
    setPlacementOverride({
      key: actualPlacementKey,
      placement: nextPlacement,
    });
  };

  return (
    <s-section heading="Design & Preview">
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
              <DevicePreviewToggle value={device} onChange={setDevice} />
              <p className="counterpulse-design-note">
                You are editing the {device} design. Switching device changes
                which campaign design is edited without copying changes to the
                other one.
              </p>
            </div>
          </section>

          <DesignControls
            mediaOptions={designMediaOptions}
            errors={errors}
            hasTimer={isTimerShown(previewViewModel.timer)}
            isProPlan={isProPlan}
            values={activeDesign}
            onChange={updateActiveDesign}
          />
        </div>

        <CampaignPreviewPanel
          actualPlacements={actualPlacements}
          className="counterpulse-design-editor__preview"
          design={design}
          device={device}
          mobileDesign={mobileDesign}
          placement={placement}
          viewModel={previewViewModel}
          onDeviceChange={setDevice}
          onPlacementChange={selectPreviewPlacement}
        />
      </div>
    </s-section>
  );
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
  if (value === "COLLECTION_CARD") return "PRODUCT_BADGE";
  if (value === "CUSTOM_SELECTOR") return "PRODUCT_PAGE";

  return "TOP_BAR";
}
