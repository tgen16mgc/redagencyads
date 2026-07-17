import { CircleIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { actionDescription } from "@/components/dashboard/action-dock-description";
import type { ActionDockAction } from "@/components/dashboard/sticky-action-dock";

function action(overrides: Partial<ActionDockAction> = {}): ActionDockAction {
  return {
    id: "analyze",
    label: "Analyze evidence",
    icon: CircleIcon,
    onSelect: vi.fn(),
    disabledReason: "Accept at least one evidence item.",
    ...overrides,
  };
}

describe("sticky action dock descriptions", () => {
  it("shows the disabled reason only while the action is disabled", () => {
    const testAction = action({ tooltip: "Review accepted evidence" });

    expect(actionDescription(testAction, true)).toBe("Accept at least one evidence item.");
    expect(actionDescription(testAction, false)).toBe("Review accepted evidence");
  });

  it("uses the action label for enabled actions without an explicit tooltip", () => {
    expect(actionDescription(action(), false)).toBe("Analyze evidence");
  });

  it("keeps the keyboard shortcut in the truthful enabled and disabled descriptions", () => {
    const testAction = action({ shortcut: "mod+enter", tooltip: "Run analysis" });

    expect(actionDescription(testAction, false)).toBe("Run analysis (Command or Control + Enter)");
    expect(actionDescription(testAction, true)).toBe(
      "Accept at least one evidence item. (Command or Control + Enter)",
    );
  });
});
