export type ReportFilterValues = {
  start: string;
  end: string;
  campaignId: string;
  placement: string;
  country: string;
  locale: string;
  market: string;
  device: string;
};

export function defaultReportFilterValues(
  now = new Date(),
): ReportFilterValues {
  const start = new Date(now.getTime() - 29 * 24 * 60 * 60_000);

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(now),
    campaignId: "",
    placement: "",
    country: "",
    locale: "",
    market: "",
    device: "",
  };
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
