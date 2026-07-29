import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureConnectorSession } from "@/lib/connector-session";
import { decryptConnectorToken } from "@/lib/connector-oauth";

describe("connector OAuth session refresh", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "connector-session-test-secret"; });
  afterEach(() => { delete process.env.SESSION_SECRET; });

  it("keeps a session that is not near expiry", async () => {
    const result = await ensureConnectorSession({
      provider: "google",
      session: { provider: "google", accessToken: "current", refreshToken: "refresh", issuedAt: Date.now(), expiresAt: "2026-08-01T00:00:00.000Z" },
      origin: "https://app.test",
      now: Date.parse("2026-07-29T00:00:00.000Z"),
      env: {},
    });
    expect(result).toMatchObject({ accessToken: "current", refreshed: false });
  });

  it("refreshes an expired session and returns a new encrypted cookie payload", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ access_token: "next", expires_in: 3600 }), { status: 200 }));
    const result = await ensureConnectorSession({
      provider: "google",
      session: { provider: "google", accessToken: "expired", refreshToken: "refresh", issuedAt: Date.now(), expiresAt: "2026-07-29T00:00:00.000Z" },
      origin: "https://app.test",
      now: Date.parse("2026-07-29T01:00:00.000Z"),
      env: { GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret" },
      fetchFn: fetchFn as typeof fetch,
    });
    expect(result.refreshed).toBe(true);
    expect(result.encryptedValue).toBeTruthy();
    expect(decryptConnectorToken(result.encryptedValue)).toMatchObject({ provider: "google", accessToken: "next", refreshToken: "refresh" });
  });

  it("requires reconnection when an expired token has no refresh token", async () => {
    await expect(ensureConnectorSession({
      provider: "linkedin",
      session: { provider: "linkedin", accessToken: "expired", issuedAt: Date.now(), expiresAt: "2026-07-29T00:00:00.000Z" },
      origin: "https://app.test",
      now: Date.parse("2026-07-29T01:00:00.000Z"),
      env: {},
    })).rejects.toThrow("reconnect");
  });
});
