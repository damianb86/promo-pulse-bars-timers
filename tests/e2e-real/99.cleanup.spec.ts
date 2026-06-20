import { test, expect } from "./helpers/fixtures";
import {
  getConfig,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import {
  cleanupE2ECampaigns,
  cleanupE2EDiscountsSafe,
  cleanupE2EProductsSafe,
} from "./helpers/cleanup";

test.describe("real E2E cleanup", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("cleans only [PP-E2E] resources when cleanup is enabled", async ({
    page,
    request,
  }) => {
    test.skip(
      !getConfig().cleanup,
      "Set REAL_E2E_CLEANUP=true to pause/delete resources created by real E2E tests.",
    );

    await cleanupE2ECampaigns(page);
    await cleanupE2EDiscountsSafe(request);
    await cleanupE2EProductsSafe(request);

    expect(getConfig().cleanup).toBe(true);
  });
});
