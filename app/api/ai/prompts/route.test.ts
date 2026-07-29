import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("AI prompt charter and version routes", () => {
  it("returns the bounded five-use-case charter and saves an active version", async () => {
    const before = await (await GET()).json();
    expect(before.charter).toHaveLength(5);
    const response = await POST(new Request("http://localhost/api/ai/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "route-copy-v1", useCase: "copy_generation", template: "Write for {{audience}}.", variables: ["audience"], changelog: "route test", active: true }) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.library.copy_generation[0]).toMatchObject({ id: "route-copy-v1", active: true, version: 1 });
  });
});
