export type DesignAlignmentValue = "LEFT" | "CENTER" | "RIGHT";
export type CampaignDesignIconValue =
  | "FIRE"
  | "CLOCK"
  | "TRUCK"
  | "GIFT"
  | "TAG"
  | "NONE";

export type CampaignDesignValues = {
  templateKey: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontSize: number;
  borderRadius: number;
  positionSticky: boolean;
  mobileEnabled: boolean;
  customCss: string;
  alignment: DesignAlignmentValue;
  showCloseButton: boolean;
  showIcon: boolean;
  icon: CampaignDesignIconValue;
};

export type CampaignDesignErrors = Partial<
  Record<keyof CampaignDesignValues, string>
> & {
  form?: string;
};

export type CampaignDesignTemplate = CampaignDesignValues & {
  label: string;
};

export const defaultCampaignDesignValues: CampaignDesignValues = {
  templateKey: "clean-minimal",
  backgroundColor: "#FFFFFF",
  textColor: "#111827",
  accentColor: "#2563EB",
  buttonColor: "#111827",
  buttonTextColor: "#FFFFFF",
  fontSize: 14,
  borderRadius: 4,
  positionSticky: false,
  mobileEnabled: true,
  customCss: "",
  alignment: "CENTER",
  showCloseButton: true,
  showIcon: false,
  icon: "NONE",
};

export const campaignDesignTemplates: CampaignDesignTemplate[] = [
  {
    ...defaultCampaignDesignValues,
    templateKey: "black-friday",
    label: "Black Friday",
    backgroundColor: "#050505",
    textColor: "#FFFFFF",
    accentColor: "#F59E0B",
    buttonColor: "#F59E0B",
    buttonTextColor: "#050505",
    fontSize: 15,
    borderRadius: 0,
    positionSticky: true,
    showIcon: true,
    icon: "TAG",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "flash-sale",
    label: "Flash Sale",
    backgroundColor: "#7F1D1D",
    textColor: "#FFFFFF",
    accentColor: "#FDE047",
    buttonColor: "#FFFFFF",
    buttonTextColor: "#7F1D1D",
    fontSize: 15,
    borderRadius: 6,
    positionSticky: true,
    showIcon: true,
    icon: "FIRE",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "free-shipping",
    label: "Free Shipping",
    backgroundColor: "#ECFDF5",
    textColor: "#064E3B",
    accentColor: "#10B981",
    buttonColor: "#047857",
    buttonTextColor: "#FFFFFF",
    borderRadius: 8,
    showIcon: true,
    icon: "TRUCK",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "delivery-cutoff",
    label: "Delivery Cutoff",
    backgroundColor: "#EFF6FF",
    textColor: "#1E3A8A",
    accentColor: "#2563EB",
    buttonColor: "#2563EB",
    buttonTextColor: "#FFFFFF",
    borderRadius: 6,
    showIcon: true,
    icon: "CLOCK",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "low-stock",
    label: "Low Stock",
    backgroundColor: "#FFF7ED",
    textColor: "#7C2D12",
    accentColor: "#EA580C",
    buttonColor: "#C2410C",
    buttonTextColor: "#FFFFFF",
    alignment: "LEFT",
    showIcon: true,
    icon: "TAG",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "clean-minimal",
    label: "Clean Minimal",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "premium-dark",
    label: "Premium Dark",
    backgroundColor: "#111827",
    textColor: "#F9FAFB",
    accentColor: "#A78BFA",
    buttonColor: "#F9FAFB",
    buttonTextColor: "#111827",
    borderRadius: 8,
    showIcon: true,
    icon: "GIFT",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "holiday",
    label: "Holiday",
    backgroundColor: "#F0FDF4",
    textColor: "#14532D",
    accentColor: "#DC2626",
    buttonColor: "#166534",
    buttonTextColor: "#FFFFFF",
    borderRadius: 10,
    showIcon: true,
    icon: "GIFT",
  },
];

export const designAlignmentOptions: Array<{
  value: DesignAlignmentValue;
  label: string;
}> = [
  { value: "LEFT", label: "Left" },
  { value: "CENTER", label: "Center" },
  { value: "RIGHT", label: "Right" },
];

export const designIconOptions: Array<{
  value: CampaignDesignIconValue;
  label: string;
}> = [
  { value: "FIRE", label: "Fire" },
  { value: "CLOCK", label: "Clock" },
  { value: "TRUCK", label: "Truck" },
  { value: "GIFT", label: "Gift" },
  { value: "TAG", label: "Tag" },
  { value: "NONE", label: "None" },
];

export function findCampaignDesignTemplate(templateKey: string) {
  return (
    campaignDesignTemplates.find(
      (template) => template.templateKey === templateKey,
    ) ??
    campaignDesignTemplates.find(
      (template) => template.templateKey === "clean-minimal",
    )!
  );
}
