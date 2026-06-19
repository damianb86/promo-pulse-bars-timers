import type { LoaderFunctionArgs } from "react-router";

import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import {
  buildAdvancedReportsCsv,
  getAdvancedReports,
} from "../services/reports/advancedReports.server";
import {
  readReportFilterValues,
  toAdvancedReportFilters,
} from "../services/reports/reportFilters.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "ADVANCED_REPORTING");

  if (!gate.allowed) {
    return new Response(gate.reason, {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const filters = toAdvancedReportFilters(readReportFilterValues(url));
  const report = await getAdvancedReports(shop.id, filters);

  return new Response(buildAdvancedReportsCsv(report), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="promo-pulse-report.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
};
