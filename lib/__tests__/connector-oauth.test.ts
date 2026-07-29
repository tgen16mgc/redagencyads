import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectorTokenNeedsRefresh, createOAuthState, decryptConnectorToken, encryptConnectorToken, verifyOAuthState } from "@/lib/connector-oauth";

describe("connector OAuth state and token storage", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "test-session-secret"; });
  afterEach(() => { delete process.env.SESSION_SECRET; });

  it("signs provider-bound return state and rejects tampering", () => {
    const state = createOAuthState("google", "/?view=intelligence&tab=connections");
    expect(verifyOAuthState(state, "google")).toMatchObject({ provider: "google", returnTo: "/?view=intelligence&tab=connections" });
    expect(verifyOAuthState(state, "linkedin")).toBeNull();
    expect(verifyOAuthState(`${state.slice(0, -1)}x`, "google")).toBeNull();
  });

  it("encrypts connector tokens and fails closed for corrupted payloads", () => {
    const encrypted = encryptConnectorToken({ provider: "linkedin", accessToken: "access-token", refreshToken: "refresh-token", expiresAt: "2026-08-01T00:00:00.000Z" });
    expect(encrypted).not.toContain("access-token");
    expect(decryptConnectorToken(encrypted)).toMatchObject({ provider: "linkedin", accessToken: "access-token", refreshToken: "refresh-token" });
    expect(decryptConnectorToken(`${encrypted.slice(0, -2)}xx`)).toBeNull();
  });

  it("refreshes only expired or near-expiry connector sessions", () => {
    const base = { provider: "google", accessToken: "access", issuedAt: Date.now() };
    expect(connectorTokenNeedsRefresh({ ...base, expiresAt: "2026-08-01T00:00:00.000Z" }, Date.parse("2026-07-29T00:00:00.000Z"))).toBe(false);
    expect(connectorTokenNeedsRefresh({ ...base, expiresAt: "2026-07-29T00:00:30.000Z" }, Date.parse("2026-07-29T00:00:00.000Z"))).toBe(true);
    expect(connectorTokenNeedsRefresh(base, Date.parse("2026-07-29T00:00:00.000Z"))).toBe(false);
  });
});
