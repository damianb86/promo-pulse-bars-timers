import { afterEach, describe, expect, it, vi } from "vitest";

import { isE2ETestMode } from "../../app/services/e2e-test.server";

describe("E2E test mode guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables E2E mode outside production when explicitly requested", () => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");

    expect(isE2ETestMode()).toBe(true);
  });

  it("never enables E2E mode in production", () => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");

    expect(isE2ETestMode()).toBe(false);
  });
});
