import type { ReactNode } from "react";

import { CampaignPreview } from "./CampaignPreview";
import { DevicePreviewToggle, type PreviewDevice } from "./DevicePreviewToggle";
import type { CampaignDesignValues } from "../types/campaign-design";
import type { CampaignViewModel } from "../utils/campaign-view-model";
import { resolveMobileCampaignDesign } from "../utils/responsive-design";

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
  mobileDesign?: CampaignDesignValues;
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
  mobileDesign,
  placement,
  viewModel,
  onDeviceChange,
  onPlacementChange,
}: CampaignPreviewPanelProps) {
  const actualPlacementSet = new Set(actualPlacements);
  const availablePlacementOptions =
    actualPlacements.length > 0
      ? previewPlacementOptions.filter((option) =>
          actualPlacementSet.has(option.value),
        )
      : previewPlacementOptions;
  const selectedPlacement = availablePlacementOptions.some(
    (option) => option.value === placement,
  )
    ? placement
    : (availablePlacementOptions[0]?.value ?? placement);
  const resolvedDesign =
    device === "mobile"
      ? resolveMobileCampaignDesign(design, mobileDesign)
      : design;

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
            value={selectedPlacement}
            onChange={(event) =>
              onPlacementChange(event.target.value as PreviewPlacement)
            }
          >
            {availablePlacementOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <CampaignPreview
        design={resolvedDesign}
        device={device}
        placement={selectedPlacement}
        viewModel={viewModel}
      />
      {meta}
    </div>
  );
}
