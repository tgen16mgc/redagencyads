import { describe, expect, it } from "vitest";
import { validateCronRequest } from "@/lib/cron-auth";

describe("cron authentication", () => {
  it("fails closed in production when no secret is configured", () => {
    expect(validateCronRequest(new Request("http://localhost"), { NODE_ENV: "production" })).toBe("missing_secret");
  });

  it("accepts the configured bearer secret and rejects other requests", () => {
    const env = { NODE_ENV: "production", CRON_SECRET: "secret" };
    expect(validateCronRequest(new Request("http://localhost", { headers: { authorization: "Bearer secret" } }), env)).toBeNull();
    expect(validateCronRequest(new Request("http://localhost"), env)).toBe("unauthorized");
  });
});
