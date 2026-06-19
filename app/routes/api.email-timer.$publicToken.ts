import type { LoaderFunctionArgs } from "react-router";

import { loadEmailTimerImageResponse } from "../services/email-timers/emailTimerEndpoint.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  return loadEmailTimerImageResponse(params.publicToken, new Date(), request);
};
