import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DialogPanel } from "@/design-system/components/DialogPanel";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DialogPanel", () => {
  it("exposes dialog semantics and closes on Escape", () => {
    const onClose = vi.fn();

    render(
      <DialogPanel
        labelledBy="dialog-title"
        onClose={onClose}
        className="dialog"
      >
        <h2 id="dialog-title">Confirm action</h2>
        <button type="button">Cancel</button>
      </DialogPanel>
    );

    const dialog = screen.getByRole("dialog", { name: "Confirm action" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps Tab focus within the dialog", () => {
    render(
      <DialogPanel
        labelledBy="dialog-title"
        onClose={() => undefined}
        className="dialog"
      >
        <h2 id="dialog-title">Confirm action</h2>
        <button type="button">First</button>
        <button type="button">Last</button>
      </DialogPanel>
    );

    const dialog = screen.getByRole("dialog");
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });
});
