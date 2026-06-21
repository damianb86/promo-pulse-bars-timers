import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { getAppFrameOrPage } from "./helpers/auth";
import {
  activateCampaign,
  clickCampaignBuilderTab,
  clickCampaignEditorTab,
  createCampaignViaUI,
  deleteCampaignIfExists,
  editCampaignBasics,
  openCampaignEditor,
  pauseAllPrefixedCampaigns,
  pauseCampaign,
  searchCampaign,
} from "./helpers/admin-app";
import { expectNoConsoleErrors } from "./helpers/assertions";

test.describe("real admin campaign CRUD", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("creates, edits, activates, pauses, duplicates, and deletes a prefixed campaign", async ({
    page,
  }) => {
    const campaignName = uniqueName("Countdown Bar");
    const updatedHeadline = `${campaignName} updated headline`;

    await pauseAllPrefixedCampaigns(page);

    await createCampaignViaUI(page, {
      headline: campaignName,
      name: campaignName,
      status: "DRAFT",
    });

    await openCampaignEditor(page, campaignName);
    await editCampaignBasics(page, {
      ctaText: "Shop collection",
      headline: updatedHeadline,
      subheadline: "Persisted after reload.",
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    const app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "campaign");
    await clickCampaignBuilderTab(app, "message");
    await expect(
      app
        .getByRole("tabpanel", { name: "Message" })
        .locator('input[name="headline"]'),
    ).toHaveValue(
      updatedHeadline,
    );

    await activateCampaign(page, campaignName);
    await pauseCampaign(page, campaignName);

    await searchCampaign(page, campaignName);
    const list = await getAppFrameOrPage(page);
    const row = list.locator("tr", { hasText: campaignName }).first();
    await row.getByRole("button", { name: /duplicate/i }).click();
    await expect(
      list.locator("tr", { hasText: campaignName }).first(),
    ).toBeVisible();

    await deleteCampaignIfExists(page, campaignName);
    await expectNoConsoleErrors(page);
  });
});
