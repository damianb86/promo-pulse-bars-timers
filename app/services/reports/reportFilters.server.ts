import { PlacementType } from "@prisma/client";

import type {
  AdvancedReportFilters,
  ReportDevice,
} from "./advancedReports.server";
import type { ReportFilterValues } from "../../types/report-filters";

export function readReportFilterValues(
  url: URL,
  now = new Date(),
): ReportFilterValues {
  const end = readDateParam(url.searchParams.get("end")) ?? now;
  const start =
    readDateParam(url.searchParams.get("start")) ??
    new Date(end.getTime() - 29 * 24 * 60 * 60_000);

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
    campaignId: readString(url.searchParams.get("campaignId")),
    placement: readPlacement(url.searchParams.get("placement")) ?? "",
    country: readCountry(url.searchParams.get("country")) ?? "",
    locale: readString(url.searchParams.get("locale")),
    market: readString(url.searchParams.get("market")),
    device: readDevice(url.searchParams.get("device")) ?? "",
  };
}

export function toAdvancedReportFilters(
  values: ReportFilterValues,
): AdvancedReportFilters {
  return {
    start: startOfDay(values.start),
    end: endOfDay(values.end),
    ...(values.campaignId ? { campaignId: values.campaignId } : {}),
    ...(values.placement
      ? { placement: values.placement as PlacementType }
      : {}),
    ...(values.country ? { country: values.country } : {}),
    ...(values.locale ? { locale: values.locale } : {}),
    ...(values.market ? { market: values.market } : {}),
    ...(values.device ? { device: values.device as ReportDevice } : {}),
  };
}

export function buildReportCsvHref(url: URL) {
  const csvUrl = new URL(url);
  const pathname = csvUrl.pathname.replace(/\.data$/, "");
  csvUrl.pathname = pathname.endsWith("/reports")
    ? `${pathname}/csv`
    : "/app/reports/csv";
  csvUrl.searchParams.delete("format");

  return `${csvUrl.pathname}${csvUrl.search}`;
}

function readDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readString(value: string | null) {
  return value?.trim() ?? "";
}

function readCountry(value: string | null) {
  const country = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(country) ? country : null;
}

function readPlacement(value: string | null) {
  return Object.values(PlacementType).includes(value as PlacementType)
    ? (value as PlacementType)
    : null;
}

function readDevice(value: string | null): ReportDevice | null {
  return value === "desktop" ||
    value === "mobile" ||
    value === "tablet" ||
    value === "unknown"
    ? value
    : null;
}
