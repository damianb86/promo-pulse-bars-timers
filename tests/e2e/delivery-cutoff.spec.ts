import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("delivery cutoff renders before cutoff message", async ({
  page,
  resetDb,
}) => {
  await resetDb("delivery-cutoff");
  await mockNow(page, "2026-06-16T20:00:00.000Z");
  await page.goto("/__test/storefront-product");

  await expect(page.locator(".pp-product-card").first()).toContainText(
    "Order within",
  );
  await expect(page.locator(".pp-product-card").first()).toContainText(
    "to get it by",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("delivery cutoff renders after cutoff window", async ({
  page,
  resetDb,
}) => {
  await resetDb("delivery-cutoff-after");
  await mockNow(page, "2026-06-17T03:59:30.000Z");
  await page.goto("/__test/storefront-product");

  await expect(page.locator(".pp-product-card").first()).toContainText(
    "Orders placed now ship",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("delivery cutoff localizes delivery dates from the storefront locale", async ({
  page,
  resetDb,
}) => {
  await resetDb("delivery-cutoff");
  await mockNow(page, "2026-06-16T20:00:00.000Z");
  await page.goto("/__test/storefront-product?locale=es");

  const card = page.locator(".pp-product-card").first();
  // Merchant copy stays as authored...
  await expect(card).toContainText("Order within");
  // ...but the interpolated {{minDeliveryDate}} follows the storefront locale:
  // Spanish formats day-first with a lowercase month ("19 jun"), never "Jun 19".
  await expect(card).toContainText(/\d{1,2} jun/);
  await expect(card).not.toContainText(/Jun \d{1,2}/);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("delivery cutoff renders the English date format for the default locale", async ({
  page,
  resetDb,
}) => {
  await resetDb("delivery-cutoff");
  await mockNow(page, "2026-06-16T20:00:00.000Z");
  await page.goto("/__test/storefront-product");

  const card = page.locator(".pp-product-card").first();
  await expect(card).toContainText(/Jun \d{1,2}/);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

async function mockNow(page: import("@playwright/test").Page, isoDate: string) {
  await page.addInitScript((value) => {
    const fixedTime = new Date(value).getTime();
    const NativeDate = Date;

    class MockDate extends NativeDate {
      constructor(value?: string | number | Date) {
        if (arguments.length === 0) {
          super(fixedTime);
        } else {
          super(value as string);
        }
      }

      static now() {
        return fixedTime;
      }
    }

    window.Date = MockDate as DateConstructor;
  }, isoDate);
}
