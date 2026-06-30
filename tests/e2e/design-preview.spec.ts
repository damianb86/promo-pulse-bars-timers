import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  selectOnlyCampaignPlacement,
  test,
} from "./fixtures";

test("design changes update live preview and persist", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("countdown");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  await page.getByRole("tab", { name: "Design" }).click();
  const editor = page.getByRole("tabpanel", { name: "Design" });
  const layoutInput = editor.locator('input[name="layout"]');
  const titleSizeInput = editor.locator('input[name="titleFontSize"]');
  const timerSizeInput = editor.locator('input[name="timerFontSize"]');
  const livePreview = page
    .locator(".counterpulse-design-editor__preview .counterpulse-preview-promo")
    .first();
  const cardPanel = editor.locator(".counterpulse-card-editor");

  await expect(cardPanel.getByRole("heading", { name: "Card" })).toBeVisible();
  await expect(cardPanel).not.toContainText(
    "Customize the appearance and layout",
  );
  await expect(cardPanel).not.toContainText("Preview");
  await expect(
    cardPanel.getByRole("radiogroup", { name: "Background" }),
  ).toBeVisible();
  await expect(
    cardPanel.getByRole("radio", { name: /Single color/ }),
  ).toBeVisible();
  await expect(
    cardPanel.getByRole("radio", { name: /Gradient/ }),
  ).toBeVisible();
  await expect(cardPanel.getByRole("radio", { name: /Image/ })).toBeVisible();

  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Split\b/ }).click();
  await expect(layoutInput).toHaveValue("BALANCED");
  await expect(titleSizeInput).toHaveValue("22");
  await expect(timerSizeInput).toHaveValue("34");
  await expect(livePreview).toHaveClass(
    /counterpulse-preview-promo--layout-balanced/,
  );

  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Inline\b/ }).click();
  await expect(layoutInput).toHaveValue("INLINE");
  await expect(titleSizeInput).toHaveValue("16");
  await expect(timerSizeInput).toHaveValue("16");
  await expect(livePreview).toHaveClass(
    /counterpulse-preview-promo--layout-inline/,
  );

  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Stacked\b/ }).click();
  await expect(layoutInput).toHaveValue("STANDARD");
  await expect(titleSizeInput).toHaveValue("22");
  await expect(timerSizeInput).toHaveValue("38");
  await expect(livePreview).toHaveClass(
    /counterpulse-preview-promo--layout-standard/,
  );

  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Action right\b/ }).click();
  await expect(layoutInput).toHaveValue("CTA_RIGHT");
  await expect(timerSizeInput).toHaveValue("32");
  await editor.getByRole("button", { name: "Preset options" }).click();
  await editor.getByRole("option", { name: /^Dawn\b/ }).click();
  await expect(layoutInput).toHaveValue("CTA_RIGHT");
  await expect(timerSizeInput).toHaveValue("32");

  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Wide stacked\b/ }).click();
  await expect(layoutInput).toHaveValue("STACKED_WIDE");
  await expect(titleSizeInput).toHaveValue("24");
  await expect(timerSizeInput).toHaveValue("36");
  await expect(livePreview).toHaveClass(
    /counterpulse-preview-promo--layout-stacked_wide/,
  );

  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Compact stack\b/ }).click();
  await expect(layoutInput).toHaveValue("COMPACT_STACK");
  await expect(titleSizeInput).toHaveValue("18");
  await expect(timerSizeInput).toHaveValue("24");
  await expect(livePreview).toHaveClass(
    /counterpulse-preview-promo--layout-compact_stack/,
  );

  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Action right\b/ }).click();
  await expect(layoutInput).toHaveValue("CTA_RIGHT");
  await expect(timerSizeInput).toHaveValue("32");
  await editor
    .getByRole("button", { name: "Plain colon", exact: true })
    .click();
  await page.getByLabel("Show timer labels").uncheck();
  await editor.locator('select[name="icon"]').selectOption("FIRE");
  await editor.locator('input[name="iconSize"]').fill("36");
  await editor.locator('input[name="gradientStartColor"]').fill("#123456");
  await editor.locator('input[name="closeButtonColor"]').fill("#00FF88");
  await editor.locator('input[name="titleFontSize"]').fill("30");
  await editor.locator('input[name="borderRadius"]').fill("12");
  await editor
    .locator('select[name="entranceAnimation"]')
    .selectOption("SLIDE");
  await editor.locator('select[name="exitAnimation"]').selectOption("POP");
  await editor.locator('input[name="animationDurationMs"]').fill("480");
  await editor
    .locator('select[name="timerTickAnimation"]')
    .selectOption("PULSE");
  await editor
    .getByLabel("Preview device")
    .first()
    .getByRole("button", { name: "Mobile" })
    .click();

  const preview = page
    .locator(".counterpulse-design-editor__preview .counterpulse-preview-promo")
    .first();
  await expect(preview).toContainText("Sale ends soon");
  await expect(preview).toHaveClass(
    /counterpulse-preview-promo--layout-cta_right/,
  );
  await expect(
    preview.locator(".counterpulse-preview-timer--colon"),
  ).toHaveText(/\d{2}:\d{2}:\d{2}/);
  await expect(
    preview.locator(".counterpulse-preview-timer--tick-pulse"),
  ).toBeVisible();
  await expect(
    preview.locator(".counterpulse-preview-timer small"),
  ).toHaveCount(0);
  const previewIcon = preview.locator(".counterpulse-preview-icon");
  await expect(previewIcon.locator("svg")).toBeVisible();
  await expect(previewIcon).toHaveCSS("width", "36px");
  await expect(previewIcon).toHaveCSS("height", "36px");
  await expect(preview.locator(".counterpulse-preview-close")).toHaveCSS(
    "color",
    "rgb(0, 255, 136)",
  );
  await expect(preview).toHaveCSS(
    "background-image",
    /linear-gradient.*rgb\(18, 52, 86\)/,
  );
  await expect(preview).toHaveClass(/counterpulse-preview-promo--enter-slide/);
  await expect(preview).toHaveClass(/counterpulse-preview-promo--exit-pop/);

  await editor.getByLabel("Show on mobile").uncheck();
  await expect(
    editor.locator(".counterpulse-preview-disabled-state"),
  ).toContainText("Not shown on mobile");
  await expect(
    page.locator(
      ".counterpulse-design-editor__preview .counterpulse-preview-promo",
    ),
  ).toHaveCount(0);
  await editor.getByLabel("Show on mobile").check();
  await expect(preview).toContainText("Sale ends soon");

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.locator("ui-save-bar").getByRole("button", { name: "Save" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Design" }).click();
  const reloadedEditor = page.getByRole("tabpanel", { name: "Design" });

  await expect(
    reloadedEditor.locator('input[name="gradientStartColor"]'),
  ).toHaveValue("#123456");
  await expect(
    reloadedEditor.locator('input[name="closeButtonColor"]'),
  ).toHaveValue("#00FF88");
  await expect(reloadedEditor.locator('input[name="layout"]')).toHaveValue(
    "CTA_RIGHT",
  );
  await expect(reloadedEditor.locator('input[name="timerStyle"]')).toHaveValue(
    "PLAIN",
  );
  await expect(reloadedEditor.locator('input[name="timerFormat"]')).toHaveValue(
    "COLON",
  );
  await expect(
    reloadedEditor.getByLabel("Show timer labels"),
  ).not.toBeChecked();
  await expect(reloadedEditor.locator('select[name="icon"]')).toHaveValue(
    "FIRE",
  );
  await expect(reloadedEditor.locator('input[name="iconSize"]')).toHaveValue(
    "36",
  );
  await expect(
    reloadedEditor.locator('input[name="titleFontSize"]'),
  ).toHaveValue("30");
  await expect(
    reloadedEditor.locator('input[name="borderRadius"]'),
  ).toHaveValue("12");
  await expect(
    reloadedEditor.locator('select[name="entranceAnimation"]'),
  ).toHaveValue("SLIDE");
  await expect(
    reloadedEditor.locator('select[name="exitAnimation"]'),
  ).toHaveValue("POP");
  await expect(
    reloadedEditor.locator('input[name="animationDurationMs"]'),
  ).toHaveValue("480");
  await expect(
    reloadedEditor.locator('select[name="timerTickAnimation"]'),
  ).toHaveValue("PULSE");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("separate desktop and mobile design uses distinct editable previews", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("countdown");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  await page.getByRole("tab", { name: "Design" }).click();

  const editor = page.getByRole("tabpanel", { name: "Design" });
  const controls = editor.locator(".counterpulse-design-editor__controls");
  const previewPanel = editor.locator(".counterpulse-design-editor__preview");
  const leftDeviceToggle = controls.getByLabel("Preview device");
  const previewDeviceToggle = previewPanel.getByLabel("Preview device");
  const preview = previewPanel.locator(".counterpulse-preview-promo").first();

  await expect(leftDeviceToggle).toHaveCount(0);
  await expect(previewDeviceToggle).toBeVisible();

  await editor.getByLabel("Separate desktop and mobile design").check();
  await expect(leftDeviceToggle).toHaveCount(1);

  await leftDeviceToggle.getByRole("button", { name: "Desktop" }).click();
  await editor.getByRole("button", { name: "Preset options" }).click();
  await editor.getByRole("option", { name: /^Black Friday\b/ }).click();
  await expect(editor.locator('input[name="templateKey"]')).toHaveValue(
    "black-friday",
  );

  await leftDeviceToggle.getByRole("button", { name: "Mobile" }).click();
  await editor.getByRole("button", { name: "Preset options" }).click();
  await editor.getByRole("option", { name: /^Love\b/ }).click();
  await expect(editor.locator('input[name="templateKey"]')).toHaveValue("love");

  await previewDeviceToggle.getByRole("button", { name: "Desktop" }).click();
  await expect(editor.locator('input[name="templateKey"]')).toHaveValue(
    "black-friday",
  );
  await expect(preview).toHaveCSS("background-color", "rgb(5, 5, 5)");

  await previewDeviceToggle.getByRole("button", { name: "Mobile" }).click();
  await expect(editor.locator('input[name="templateKey"]')).toHaveValue("love");
  await expect(preview).toHaveCSS(
    "background-image",
    /linear-gradient.*rgb\(230, 57, 70\).*rgb\(255, 53, 162\)/,
  );

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.locator("ui-save-bar").getByRole("button", { name: "Save" }).click(),
  ]);

  await page.reload();
  await page.getByRole("tab", { name: "Design" }).click();

  const reloadedEditor = page.getByRole("tabpanel", { name: "Design" });
  const reloadedControls = reloadedEditor.locator(
    ".counterpulse-design-editor__controls",
  );
  const reloadedPreviewPanel = reloadedEditor.locator(
    ".counterpulse-design-editor__preview",
  );
  const reloadedLeftToggle = reloadedControls.getByLabel("Preview device");
  const reloadedPreviewToggle =
    reloadedPreviewPanel.getByLabel("Preview device");
  const reloadedPreview = reloadedPreviewPanel
    .locator(".counterpulse-preview-promo")
    .first();

  await expect(
    reloadedEditor.getByLabel("Separate desktop and mobile design"),
  ).toBeChecked();
  await expect(reloadedLeftToggle).toHaveCount(1);
  await expect(reloadedEditor.locator('input[name="templateKey"]')).toHaveValue(
    "black-friday",
  );
  await expect(reloadedPreview).toHaveCSS("background-color", "rgb(5, 5, 5)");

  await reloadedPreviewToggle.getByRole("button", { name: "Mobile" }).click();
  await expect(reloadedEditor.locator('input[name="templateKey"]')).toHaveValue(
    "love",
  );
  await expect(reloadedPreview).toHaveCSS(
    "background-image",
    /linear-gradient.*rgb\(230, 57, 70\).*rgb\(255, 53, 162\)/,
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("placement preview only lists selected campaign placements and CSS reference is scrollable", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("countdown");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  await page.getByRole("tab", { name: "Campaign" }).click();
  await page.getByRole("tab", { name: "Placement" }).click();
  await selectOnlyCampaignPlacement(page, "PRODUCT_PAGE");
  await page.getByRole("button", { name: /^Cart drawer\b/ }).click();

  await page.getByRole("tab", { name: "Design" }).click();
  const placementSelect = page
    .locator(".counterpulse-design-editor__preview")
    .getByLabel("Placement preview");

  await expect(placementSelect).toHaveValue("CART_DRAWER");
  await expect(
    page.locator(".counterpulse-design-editor__preview"),
  ).not.toContainText("* Campaign placement");

  const placementOptions = await placementSelect
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => option.textContent?.trim() ?? ""),
    );
  expect(placementOptions).toHaveLength(2);
  expect(placementOptions).toEqual(
    expect.arrayContaining(["Cart drawer block", "Product page block"]),
  );
  expect(placementOptions).not.toEqual(
    expect.arrayContaining(["Top bar", "Bottom bar", "Badge"]),
  );
  expect(placementOptions.some((label) => label.includes("*"))).toBe(false);

  await placementSelect.selectOption("PRODUCT_PAGE");
  await expect(
    page.locator(
      ".counterpulse-design-editor__preview .counterpulse-preview-browser-bar strong",
    ),
  ).toHaveText("Product page");

  await page.getByTitle("About Custom CSS").click();
  const cssDialog = page.getByRole("dialog", {
    name: "Custom CSS reference",
  });
  await expect(cssDialog).toBeVisible();
  await expect(cssDialog).toHaveClass(/counterpulse-modal--css-reference/);

  const dialogBox = await cssDialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dialogBox!.width).toBeGreaterThan(viewport!.width * 0.7);
  expect(dialogBox!.width).toBeLessThanOrEqual(viewport!.width * 0.82);
  await expect(cssDialog.locator(".counterpulse-modal__body")).toHaveCSS(
    "overflow-y",
    "auto",
  );

  await cssDialog.getByRole("button", { name: "Close" }).click();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("top and bottom bar placement defaults to full width without rounded corners", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("countdown");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  await page.getByRole("tab", { name: "Design" }).click();
  const editor = page.getByRole("tabpanel", { name: "Design" });
  await editor.locator('input[name="borderRadius"]').fill("14");

  await page.getByRole("tab", { name: "Campaign" }).click();
  await page.getByRole("tab", { name: "Placement" }).click();
  await page.getByRole("button", { name: /^Bottom bar\b/ }).click();
  await page.getByRole("tab", { name: "Design" }).click();

  const updatedEditor = page.getByRole("tabpanel", { name: "Design" });
  await expect(updatedEditor.locator('input[name="borderRadius"]')).toHaveValue(
    "0",
  );
  await expect(updatedEditor.locator('input[name="fullWidth"]')).toBeChecked();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
