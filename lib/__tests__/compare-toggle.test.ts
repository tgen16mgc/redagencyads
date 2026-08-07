import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Label, Switch } from "@heroui/react";
import { describe, expect, it } from "vitest";

/**
 * The compare-mode toggle was inert because `Switch.Control` was rendered as a
 * direct child of the Switch root. React Aria's `SwitchField` is only a state
 * container - it renders a plain div and strips `onClick`. The interactive
 * `SwitchButton` (and the hidden input) is rendered by `Switch.Content`, so
 * omitting it produces a switch that cannot be clicked.
 */
describe("HeroUI Switch anatomy", () => {
  const control = () => h(Switch.Control, null, h(Switch.Thumb, null));

  it("renders no interactive input when Switch.Content is missing", () => {
    const markup = renderToStaticMarkup(
      h(Switch, { isSelected: false }, control(), h(Label, null, "Compare mode")),
    );
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain('data-slot="switch-content"');
  });

  it("renders an interactive checkbox input when wrapped in Switch.Content", () => {
    const markup = renderToStaticMarkup(
      h(Switch, { isSelected: false }, h(Switch.Content, null, control(), h(Label, null, "Compare mode"))),
    );
    expect(markup).toContain('data-slot="switch-content"');
    expect(markup).toContain("<input");
    expect(markup).toContain('type="checkbox"');
  });

  it("reflects the selected state through the rendered input", () => {
    const markup = renderToStaticMarkup(
      h(Switch, { isSelected: true }, h(Switch.Content, null, control(), h(Label, null, "Compare mode"))),
    );
    expect(markup).toContain("checked");
  });
});
