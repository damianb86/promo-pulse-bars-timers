import { useMemo, useState } from "react";
import { AppAlert } from "./Notifications";

import { DesignControls } from "./DesignControls";
import {
  CampaignPreviewPanel,
  type PreviewPlacement,
} from "./CampaignPreviewPanel";
import type { PreviewDevice } from "./DevicePreviewToggle";
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
  onChange: (design: CampaignDesignValues) => void;
  viewModel: CampaignViewModel;
};

export function CampaignDesignEditor({
  design,
  designMediaOptions = emptyCampaignDesignMediaOptions,
  errors,
  isProPlan,
  lockedCustomCssReason,
  onChange,
  viewModel,
}: CampaignDesignEditorProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [placement, setPlacement] = useState<PreviewPlacement>("PRODUCT_PAGE");
  const previewViewModel = useMemo(
    () => ({
      ...viewModel,
      design,
    }),
    [design, viewModel],
  );

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
          <DesignControls
            mediaOptions={designMediaOptions}
            errors={errors}
            isProPlan={isProPlan}
            values={design}
            onChange={onChange}
          />
        </div>

        <CampaignPreviewPanel
          className="counterpulse-design-editor__preview"
          design={design}
          device={device}
          placement={placement}
          viewModel={previewViewModel}
          onDeviceChange={setDevice}
          onPlacementChange={setPlacement}
        />
      </div>
    </s-section>
  );
}
