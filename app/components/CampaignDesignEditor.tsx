import { useMemo, useState } from "react";
import { AppAlert, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import { DesignControls } from "./DesignControls";
import { CampaignPreview } from "./CampaignPreview";
import { DevicePreviewToggle, type PreviewDevice } from "./DevicePreviewToggle";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";
import type {
  CampaignDesignErrors,
  CampaignDesignValues,
} from "../types/campaign-design";
import type { CampaignViewModel } from "../utils/campaign-view-model";

type PreviewPlacement =
  | "TOP_BAR"
  | "BOTTOM_BAR"
  | "PRODUCT_PAGE"
  | "CART_PAGE"
  | "CART_DRAWER"
  | "PRODUCT_BADGE";

type CampaignDesignEditorProps = {
  initialDesign: CampaignDesignValues;
  errors?: CampaignDesignErrors;
  isProPlan: boolean;
  lockedCustomCssReason?: string;
  viewModel: CampaignViewModel;
};

const previewPlacementOptions: Array<{
  value: PreviewPlacement;
  label: string;
}> = [
  { value: "TOP_BAR", label: "Top bar" },
  { value: "BOTTOM_BAR", label: "Bottom bar" },
  { value: "PRODUCT_PAGE", label: "Product page block" },
  { value: "CART_PAGE", label: "Cart page block" },
  { value: "CART_DRAWER", label: "Cart drawer block" },
  { value: "PRODUCT_BADGE", label: "Badge" },
];

export function CampaignDesignEditor({
  initialDesign,
  errors,
  isProPlan,
  lockedCustomCssReason,
  viewModel,
}: CampaignDesignEditorProps) {
  const navigation = useNavigation();
  const [design, setDesign] = useState(initialDesign);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [placement, setPlacement] = useState<PreviewPlacement>("TOP_BAR");
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save design",
    title: "Save campaign design?",
    children: (
      <p>
        This updates visual styling for the campaign widget across enabled
        placements. Review the preview before confirming.
      </p>
    ),
  });
  const previewViewModel = useMemo(
    () => ({
      ...viewModel,
      design,
    }),
    [design, viewModel],
  );

  return (
    <s-section heading="Design & Preview">
      <p className="counterpulse-section-description">
        Tune colors, typography, layout, and preview placement so the widget
        matches the campaign and store design.
      </p>

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

      <Form
        method="post"
        className="counterpulse-design-editor"
        onSubmit={confirmSubmit.onSubmit}
      >
        <input name="_action" type="hidden" value="saveDesign" />

        <div className="counterpulse-design-editor__controls">
          <DesignControls
            errors={errors}
            isProPlan={isProPlan}
            values={design}
            onChange={setDesign}
          />
          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save design"}
            </button>
            {!isProPlan && (
              <span className="counterpulse-muted">
                Custom CSS is gated for Pro.
              </span>
            )}
          </div>
        </div>

        <div className="counterpulse-design-editor__preview">
          <div className="counterpulse-preview-toolbar">
            <DevicePreviewToggle value={device} onChange={setDevice} />
            <label className="counterpulse-form-field">
              <span>Placement preview</span>
              <select
                value={placement}
                onChange={(event) =>
                  setPlacement(event.target.value as PreviewPlacement)
                }
              >
                {previewPlacementOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <CampaignPreview
            design={design}
            device={device}
            placement={placement}
            viewModel={previewViewModel}
          />
        </div>
      </Form>
      {confirmSubmit.modal}
    </s-section>
  );
}
