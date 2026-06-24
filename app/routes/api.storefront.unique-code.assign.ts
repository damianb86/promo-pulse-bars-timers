import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  handleUniqueCodeAssignAction,
  loadUniqueCodeAssignResponse,
} from "../services/storefront-unique-code-assign.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return loadUniqueCodeAssignResponse(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleUniqueCodeAssignAction(request);
};
