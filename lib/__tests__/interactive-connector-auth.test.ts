import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptConnectorToken } from "@/lib/connector-oauth";

const { cookieStore, cookies } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
  cookies: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));

import { requireConnectorSessionAccessToken } from "@/lib/interactive-connector-auth";
import { SessionAuthError } from "@/lib/session";

describe("interactive connector authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "interactive-connector-test-secret";
    process.env.GOOGLE_ADS_ACCESS_TOKEN = "server-token";
    cookieStore.get.mockReturnValue(undefined);
    cookies.mockResolvedValue(cookieStore);
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.GOOGLE_ADS_ACCESS_TOKEN;
  });

  it("rejects a missing browser session even when a server token exists", async () => {
    await expect(
      requireConnectorSessionAccessToken(
        new Request("https://app.test/api/intelligence/sync"),
        "google",
      ),
    ).rejects.toBeInstanceOf(SessionAuthError);
  });

  it("returns the encrypted browser OAuth token for the matching provider", async () => {
    cookieStore.get.mockReturnValue({
      value: encryptConnectorToken({
        provider: "google",
        accessToken: "oauth-token",
      }),
    });

    await expect(
      requireConnectorSessionAccessToken(
        new Request("https://app.test/api/intelligence/sync"),
        "google",
      ),
    ).resolves.toBe("oauth-token");
  });

  it("rejects a connector cookie bound to another provider", async () => {
    cookieStore.get.mockReturnValue({
      value: encryptConnectorToken({
        provider: "linkedin",
        accessToken: "linkedin-token",
      }),
    });

    await expect(
      requireConnectorSessionAccessToken(
        new Request("https://app.test/api/intelligence/sync"),
        "google",
      ),
    ).rejects.toBeInstanceOf(SessionAuthError);
  });
});
