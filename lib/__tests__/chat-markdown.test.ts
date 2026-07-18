import { describe, expect, it } from "vitest";
import { parseChatMarkdown } from "@/lib/ai/chat-markdown";

describe("parseChatMarkdown", () => {
  it("parses client-ready headings, highlights, dividers, lists, and tables", () => {
    const blocks = parseChatMarkdown(`**Client-Ready Performance Summary**
**Account:** Eric 2 NLM | **Campaign:** TBW

---

### Key Highlights
- **Spend:** 5.85M VND
- **Messages:** 50

| Metric | Jul | Jun | Change |
|--------|-----|-----|--------|
| Spend | 5.85M | 5.06M | +16% |`);

    expect(blocks).toEqual([
      { type: "heading", level: 1, content: "Client-Ready Performance Summary" },
      { type: "paragraph", lines: ["**Account:** Eric 2 NLM | **Campaign:** TBW"] },
      { type: "divider" },
      { type: "heading", level: 3, content: "Key Highlights" },
      { type: "unordered-list", items: ["**Spend:** 5.85M VND", "**Messages:** 50"] },
      {
        type: "table",
        headers: ["Metric", "Jul", "Jun", "Change"],
        rows: [["Spend", "5.85M", "5.06M", "+16%"]],
      },
    ]);
  });

  it("keeps unsupported content as escaped renderable text blocks", () => {
    expect(parseChatMarkdown("<script>alert('x')</script>")).toEqual([
      { type: "paragraph", lines: ["<script>alert('x')</script>"] },
    ]);
  });
});
