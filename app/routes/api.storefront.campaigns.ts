import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  handleStorefrontCampaignsAction,
  loadStorefrontCampaignsResponse,
} from "../services/storefront-campaigns-response.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return loadStorefrontCampaignsResponse(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleStorefrontCampaignsAction(request);
};
