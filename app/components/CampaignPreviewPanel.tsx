import type { ReactNode } from "react";

import { CampaignPreview } from "./CampaignPreview";
import { DevicePreviewToggle, type PreviewDevice } from "./DevicePreviewToggle";
import type { CampaignDesignValues } from "../types/campaign-design";
import type { CampaignViewModel } from "../utils/campaign-view-model";

export type PreviewPlacement =
  | "TOP_BAR"
  | "BOTTOM_BAR"
  | "PRODUCT_PAGE"
  | "CART_PAGE"
  | "CART_DRAWER"
  | "PRODUCT_BADGE";

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

type CampaignPreviewPanelProps = {
  actualPlacements?: PreviewPlacement[];
  className?: string;
  design: CampaignDesignValues;
  device: PreviewDevice;
  meta?: ReactNode;
  placement: PreviewPlacement;
  viewModel: CampaignViewModel;
  onDeviceChange: (device: PreviewDevice) => void;
  onPlacementChange: (placement: PreviewPlacement) => void;
};

export function CampaignPreviewPanel({
  actualPlacements = [],
  className = "",
  design,
  device,
  meta,
  placement,
  viewModel,
  onDeviceChange,
  onPlacementChange,
}: CampaignPreviewPanelProps) {
  const actualPlacementSet = new Set(actualPlacements);

  return (
    <div
      className={["counterpulse-preview-panel", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="counterpulse-preview-toolbar">
        <DevicePreviewToggle value={device} onChange={onDeviceChange} />
        <label className="counterpulse-form-field counterpulse-preview-placement-field">
          <span>Placement preview</span>
          <select
            value={placement}
            onChange={(event) =>
              onPlacementChange(event.target.value as PreviewPlacement)
            }
          >
            {previewPlacementOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {actualPlacementSet.has(option.value) ? " *" : ""}
              </option>
            ))}
          </select>
          {actualPlacements.length > 0 && <small>* Campaign placement</small>}
        </label>
      </div>
      <CampaignPreview
        design={design}
        device={device}
        placement={placement}
        viewModel={viewModel}
      />
      {meta}
    </div>
  );
}
