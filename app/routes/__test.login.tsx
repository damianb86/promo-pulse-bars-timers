import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import {
  buildE2ELoginCookie,
  ensureE2EShop,
  requireE2ETestMode,
} from "../services/e2e-test.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  requireE2ETestMode();
  await ensureE2EShop();

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/app";

  return redirect(returnTo.startsWith("/") ? returnTo : "/app", {
    headers: {
      "Set-Cookie": buildE2ELoginCookie(),
    },
  });
};
