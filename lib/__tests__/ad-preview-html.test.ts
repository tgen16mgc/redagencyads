import { describe, expect, it } from "vitest";
import { sanitizeAdPreviewHtml } from "@/lib/ad-preview-html";

const META_PREVIEW =
  '<iframe src="https://www.facebook.com/ads/api/preview_iframe.php?d=abc&t=1" width="540" height="690" scrolling="yes" style="border:none;"></iframe>';

describe("sanitizeAdPreviewHtml", () => {
  it("keeps a legitimate Meta preview iframe intact", () => {
    expect(sanitizeAdPreviewHtml(META_PREVIEW)).toBe(META_PREVIEW);
  });

  it("keeps benign markup and safe urls", () => {
    const html = '<div class="ad"><a href="https://example.com/promo">Shop</a><img src="/images/ad.png" alt="ad"></div>';
    expect(sanitizeAdPreviewHtml(html)).toBe(html);
  });

  it("strips script elements", () => {
    expect(sanitizeAdPreviewHtml("<p>hi</p><script>alert(1)</script><p>bye</p>")).toBe("<p>hi</p><p>bye</p>");
  });

  it("strips script elements in mixed casing", () => {
    expect(sanitizeAdPreviewHtml('<ScRiPt SRC="https://evil.example/x.js"></sCrIpT>x')).toBe("x");
  });

  it("strips unclosed script tags to the end of input", () => {
    expect(sanitizeAdPreviewHtml("<p>ok</p><script>alert(1)")).toBe("<p>ok</p>");
  });

  it("strips nested scripts and stray closing tags", () => {
    expect(sanitizeAdPreviewHtml("<script><script>alert(1)</script></script>")).not.toMatch(/<script/i);
    expect(sanitizeAdPreviewHtml("a</script>b")).toBe("ab");
  });

  it("defeats script tag reassembly", () => {
    const reassembly = "<scr<script></script>ipt>alert(1)</scr<script></script>ipt>";
    expect(sanitizeAdPreviewHtml(reassembly)).not.toMatch(/<script/i);
    expect(sanitizeAdPreviewHtml("<scr</script>ipt>alert(1)")).not.toMatch(/<script/i);
  });

  it("strips quoted, unquoted, and mixed-case event handlers", () => {
    expect(sanitizeAdPreviewHtml('<img src="/x.png" onerror="alert(1)">')).toBe('<img src="/x.png">');
    expect(sanitizeAdPreviewHtml("<img src='/x.png' ONERROR='alert(1)'>")).toBe("<img src='/x.png'>");
    expect(sanitizeAdPreviewHtml("<body onload=alert(1)>")).toBe("<body>");
    expect(sanitizeAdPreviewHtml('<div onclick\n=\n"alert(1)">x</div>')).toBe("<div>x</div>");
  });

  it("strips slash-separated event handlers", () => {
    expect(sanitizeAdPreviewHtml("<img/onerror=alert(1) src=x>")).toBe("<img src=x>");
  });

  it("defeats event handler reassembly through tag removal", () => {
    expect(sanitizeAdPreviewHtml("<img src=x on<script></script>error=alert(1)>")).not.toMatch(/on\w+\s*=/i);
  });

  it("drops javascript: hrefs in case and whitespace variants", () => {
    expect(sanitizeAdPreviewHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href=" javascript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="java\nscript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="java\tscript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml("<a href=javascript:alert(1)>x</a>")).toBe("<a >x</a>");
  });

  it("drops entity-obfuscated javascript: urls", () => {
    expect(sanitizeAdPreviewHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="&#x6A;avascript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="&#106avascript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="jav&#x0A;ascript:alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="javascript&colon;alert(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="java&Tab;script:alert(1)">x</a>')).toBe("<a >x</a>");
  });

  it("drops vbscript: and data: urls", () => {
    expect(sanitizeAdPreviewHtml('<a href="vbscript:msgbox(1)">x</a>')).toBe("<a >x</a>");
    expect(sanitizeAdPreviewHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).not.toMatch(/data:|<script/i);
    expect(sanitizeAdPreviewHtml('<iframe src="data:text/html;base64,PHNjcmlwdD4="></iframe>')).toBe("<iframe ></iframe>");
  });

  it("neutralizes hostile iframes while keeping the element", () => {
    expect(sanitizeAdPreviewHtml('<iframe src="javascript:alert(1)"></iframe>')).toBe("<iframe ></iframe>");
    expect(sanitizeAdPreviewHtml('<iframe srcdoc="<img src=x onerror=alert(1)>"></iframe>')).toBe("<iframe></iframe>");
  });

  it("removes object and embed tags", () => {
    expect(sanitizeAdPreviewHtml('<object data="https://evil.example/x.swf">fallback</object>')).toBe("fallback");
    expect(sanitizeAdPreviewHtml('<embed src="https://evil.example/x.swf">')).toBe("");
    expect(sanitizeAdPreviewHtml('<EMBED SRC="javascript:alert(1)">')).toBe("");
  });

  it("drops javascript: in src, action, and formaction", () => {
    expect(sanitizeAdPreviewHtml('<img src="javascript:alert(1)">')).toBe("<img >");
    expect(
      sanitizeAdPreviewHtml('<form action="javascript:alert(1)"><button formaction="javascript:alert(2)">x</button></form>'),
    ).toBe("<form ><button >x</button></form>");
  });
});
