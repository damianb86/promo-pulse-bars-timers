import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

// A valid 1x1 transparent PNG used as the uploaded reference image.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMEAQEY1Jl5AAAAAElFTkSuQmCC",
  "base64",
);

async function openAiDrawer(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "AI campaign" }).click();
  const aiBuilder = page.locator(".counterpulse-ai-builder");
  await expect(
    aiBuilder.getByText("Start with intent, not copywriting"),
  ).toBeVisible();
  return aiBuilder;
}

test("uploads a reference image and generates a draft without a description", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("pro");
  await loginAsDemoShop("/app/campaigns/new");

  const aiBuilder = await openAiDrawer(page);
  await expect(
    aiBuilder.getByRole("heading", {
      name: "Match an existing banner or timer (optional)",
    }),
  ).toBeVisible();

  // The dropzone is shown until an image is attached.
  await expect(aiBuilder.getByText("Drag & drop an image here")).toBeVisible();

  await aiBuilder.locator('input[type="file"]').setInputFiles({
    name: "promo-bar.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });

  // Preview + file name appear, dropzone is replaced.
  await expect(
    aiBuilder.locator(".counterpulse-ai-image-preview__image"),
  ).toBeVisible();
  await expect(aiBuilder.getByText("promo-bar.png")).toBeVisible();
  await expect(aiBuilder.getByText("Drag & drop an image here")).toBeHidden();

  // With an image attached, ignore toggles appear and default to on, so the
  // other inputs are disabled (the campaign type is still selectable).
  await expect(aiBuilder.getByRole("switch").first()).toBeVisible();
  await expect(
    aiBuilder.getByRole("textbox", {
      name: "Product, collection, or audience",
    }),
  ).toBeDisabled();

  // Description is optional with an image attached: generate directly.
  await aiBuilder.getByRole("button", { name: "Generate with AI" }).click();

  await expect(page.getByText("AI suggestion preview")).toBeVisible();
  // The campaign preview surface is rendered at the top of the suggestion, and
  // the old "Generated from your image" banner is gone.
  await expect(page.getByTestId("ai-suggestion-preview-surface")).toBeVisible();
  await expect(page.getByText("Generated from your image")).toHaveCount(0);

  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(page.locator(".counterpulse-ai-drawer")).toBeHidden();
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("un-ignoring a field re-enables its input", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("pro");
  await loginAsDemoShop("/app/campaigns/new");

  const aiBuilder = await openAiDrawer(page);
  await aiBuilder.locator('input[type="file"]').setInputFiles({
    name: "promo-bar.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });

  const productField = aiBuilder.getByRole("textbox", {
    name: "Product, collection, or audience",
  });
  await expect(productField).toBeDisabled();

  // Toggle the Ignore switch inside the product field's row.
  await productField
    .locator("xpath=ancestor::label[1]")
    .getByRole("switch")
    .click();
  await expect(productField).toBeEnabled();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("rejects an unsupported file type and keeps the dropzone", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("pro");
  await loginAsDemoShop("/app/campaigns/new");

  const aiBuilder = await openAiDrawer(page);

  await aiBuilder.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(aiBuilder.getByText("Image could not be used")).toBeVisible();
  await expect(
    aiBuilder.getByText(
      "Unsupported image type. Use a PNG, JPG, JPEG, or WEBP file.",
    ),
  ).toBeVisible();
  // No preview is shown for an invalid file; the dropzone stays.
  await expect(
    aiBuilder.locator(".counterpulse-ai-image-preview__image"),
  ).toHaveCount(0);
  await expect(aiBuilder.getByText("Drag & drop an image here")).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("removes and replaces the reference image before generating", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("pro");
  await loginAsDemoShop("/app/campaigns/new");

  const aiBuilder = await openAiDrawer(page);
  const fileInput = aiBuilder.locator('input[type="file"]');

  await fileInput.setInputFiles({
    name: "first.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await expect(aiBuilder.getByText("first.png")).toBeVisible();

  // Replace swaps the attached image.
  await fileInput.setInputFiles({
    name: "second.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await expect(aiBuilder.getByText("second.png")).toBeVisible();
  await expect(aiBuilder.getByText("first.png")).toHaveCount(0);

  // Remove returns to the dropzone.
  await aiBuilder.getByRole("button", { name: "Remove" }).click();
  await expect(aiBuilder.getByText("Drag & drop an image here")).toBeVisible();
  await expect(
    aiBuilder.locator(".counterpulse-ai-image-preview__image"),
  ).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
