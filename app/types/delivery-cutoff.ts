import type { AfterCutoffBehavior } from "../lib/delivery-promise";

export const afterCutoffBehaviorOptions = [
  { value: "SHOW_NEXT_WINDOW", label: "Show next delivery window" },
  { value: "SHOW_AFTER_CUTOFF_MESSAGE", label: "Show after-cutoff message" },
  { value: "HIDE", label: "Hide after cutoff" },
] as const;

export type AfterCutoffBehaviorValue =
  (typeof afterCutoffBehaviorOptions)[number]["value"];

export type DeliveryCutoffSettingsValues = {
  cutoffHour: string;
  cutoffMinute: string;
  timezone: string;
  processingDays: string;
  minDeliveryDays: string;
  maxDeliveryDays: string;
  workingDaysJson: string;
  holidaysJson: string;
  countryRulesJson: string;
  afterCutoffBehavior: AfterCutoffBehaviorValue;
};

export type DeliveryCutoffSettingsErrors = Partial<
  Record<keyof DeliveryCutoffSettingsValues, string>
> & {
  form?: string;
};

export const defaultDeliveryCutoffSettingsValues: DeliveryCutoffSettingsValues =
  {
    afterCutoffBehavior: "SHOW_NEXT_WINDOW",
    countryRulesJson: "",
    cutoffHour: "14",
    cutoffMinute: "0",
    holidaysJson: "[]",
    maxDeliveryDays: "5",
    minDeliveryDays: "2",
    processingDays: "0",
    timezone: "UTC",
    workingDaysJson: "[1,2,3,4,5]",
  };

export function toAfterCutoffBehavior(
  value: string | null | undefined,
): AfterCutoffBehavior {
  if (
    value === "SHOW_NEXT_WINDOW" ||
    value === "SHOW_AFTER_CUTOFF_MESSAGE" ||
    value === "HIDE"
  ) {
    return value;
  }

  return "SHOW_NEXT_WINDOW";
}
