import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSession, encryptSession } from "../session";

const originalSecret = process.env.SESSION_SECRET;

describe("encrypted token sessions", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T00:00:00.000Z"));
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSecret;
    }
    vi.useRealTimers();
  });

  it("round-trips an encrypted token payload", () => {
    const encrypted = encryptSession("meta-token-123");

    expect(encrypted).not.toContain("meta-token-123");
    expect(decryptSession(encrypted)).toEqual({
      token: "meta-token-123",
      issuedAt: new Date("2026-06-05T00:00:00.000Z").getTime(),
    });
  });

  it("returns null after the cookie max age", () => {
    const encrypted = encryptSession("meta-token-123");
    vi.setSystemTime(new Date("2026-06-05T13:00:00.000Z"));

    expect(decryptSession(encrypted)).toBeNull();
  });

  it("returns null for a malformed cookie instead of throwing", () => {
    expect(decryptSession("not-a-real-cookie")).toBeNull();
    expect(decryptSession("")).toBeNull();
  });

  it("returns null for a tampered auth tag instead of throwing", () => {
    const encrypted = encryptSession("meta-token-123");
    const raw = Buffer.from(encrypted, "base64url");
    raw[13] ^= 0xff;
    const tampered = raw.toString("base64url");

    expect(decryptSession(tampered)).toBeNull();
  });

  it("returns null when the secret has rotated since the cookie was issued", () => {
    const encrypted = encryptSession("meta-token-123");
    process.env.SESSION_SECRET = "rotated-secret";

    expect(decryptSession(encrypted)).toBeNull();
  });
});
