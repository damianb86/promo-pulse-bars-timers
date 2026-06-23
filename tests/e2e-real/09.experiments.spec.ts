import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import {
  createCountdownCampaign,
  createExperimentViaUI,
  openCampaignEditor,
} from "./helpers/admin-app";
import { getAppFrameOrPage } from "./helpers/auth";
import { expectNoConsoleErrors } from "./helpers/assertions";

test.describe("real experiments", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("creates an A/B experiment from a prefixed campaign", async ({
    page,
  }, testInfo) => {
    const campaignName = await createCountdownCampaign(
      page,
      uniqueName("Experiment Base"),
    );
    await openCampaignEditor(page, campaignName);
    const app = await getAppFrameOrPage(page);

    if (
      await app
        .getByText(/experiments are locked/i)
        .isVisible()
        .catch(() => false)
    ) {
      testInfo.skip(
        true,
        "Experiments require a plan that enables AB testing.",
      );
    }

    const experimentName = await createExperimentViaUI(page, campaignName);
    const refreshedApp = await getAppFrameOrPage(page);

    await expect(
      refreshedApp.getByRole("heading", { name: experimentName }).first(),
    ).toBeVisible();
    await expectNoConsoleErrors(page);
  });
});
