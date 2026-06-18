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
