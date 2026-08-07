import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing ${selector} block in globals.css`);
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

function tokens(selector: string) {
  const map = new Map<string, string>();
  for (const line of block(selector).split("\n")) {
    const match = line.match(/^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/);
    if (match) map.set(match[1], match[2].toLowerCase());
  }
  return map;
}

function channel(value: number) {
  const ratio = value / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const statusTokens = ["--success", "--warning", "--info", "--destructive"] as const;

describe("status colour contrast", () => {
  const dark = tokens(":root");
  const light = tokens(".light");

  it("defines a light-mode override for every status colour", () => {
    for (const token of statusTokens) {
      expect(light.get(token), `${token} must be re-tuned for the light theme`).toBeDefined();
      expect(light.get(token)).not.toBe(dark.get(token));
    }
  });

  it("keeps status colours readable on light surfaces", () => {
    const surfaces = ["--card", "--popover", "--background", "--secondary", "--muted", "--accent"];
    for (const token of statusTokens) {
      for (const surface of surfaces) {
        const background = light.get(surface);
        if (!background) continue;
        const ratio = contrast(light.get(token)!, background);
        expect(ratio, `${token} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps status colours readable on dark surfaces", () => {
    for (const token of statusTokens) {
      for (const surface of ["--card", "--popover", "--background"]) {
        const ratio = contrast(dark.get(token)!, dark.get(surface)!);
        expect(ratio, `${token} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
