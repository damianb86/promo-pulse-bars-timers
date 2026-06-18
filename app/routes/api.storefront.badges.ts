import type { LoaderFunctionArgs } from "react-router";

import { loadStorefrontBadgesResponse } from "../services/badges/storefrontBadges.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return loadStorefrontBadgesResponse(request);
};
