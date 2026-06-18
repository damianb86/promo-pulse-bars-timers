import type { LoaderFunctionArgs } from "react-router";

import { loadEmailTimerImageResponse } from "../services/email-timers/emailTimerEndpoint.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  return loadEmailTimerImageResponse(params.publicToken);
};
