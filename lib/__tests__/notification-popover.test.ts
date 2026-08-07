import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Popover } from "@heroui/react";
import { describe, expect, it } from "vitest";

/**
 * Guards the same class of bug as the compare-mode switch: a HeroUI compound
 * component whose trigger renders no interactive element, leaving a control
 * that looks correct but cannot be activated.
 *
 * `Popover.Trigger` renders a div rather than a native button, so assert on the
 * accessibility contract React Aria relies on for press handling instead of the
 * tag name.
 */
describe("notification popover trigger", () => {
  const markup = renderToStaticMarkup(
    h(Popover, null,
      h(Popover.Trigger, { className: "v2-icon-button", "aria-label": "3 unread notifications" }, "bell")),
  );

  it("exposes an activatable control", () => {
    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('data-react-aria-pressable="true"');
  });

  it("keeps the accessible name and expanded state", () => {
    expect(markup).toContain('aria-label="3 unread notifications"');
    expect(markup).toContain('aria-expanded="false"');
  });
});
