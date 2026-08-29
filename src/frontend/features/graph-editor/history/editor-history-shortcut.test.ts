import { describe, expect, it } from "vitest";

import { getEditorHistoryShortcut } from "./use-editor-history";

function shortcut(
  overrides: Partial<
    Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "target">
  > = {},
) {
  return getEditorHistoryShortcut({
    key: "z",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    target: document.body,
    ...overrides,
  });
}

describe("editor history shortcuts", () => {
  it("maps platform Undo and Redo shortcuts", () => {
    expect(shortcut({ key: "z", metaKey: true })).toBe("undo");
    expect(shortcut({ key: "Z", ctrlKey: true })).toBe("undo");
    expect(shortcut({ key: "z", metaKey: true, shiftKey: true })).toBe("redo");
    expect(shortcut({ key: "Z", ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(shortcut({ key: "y", ctrlKey: true })).toBe("redo");
    expect(shortcut({ key: "y", metaKey: true })).toBeNull();
    expect(shortcut({ key: "x", ctrlKey: true })).toBeNull();
  });

  it("ignores shortcuts from editable targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(shortcut({ ctrlKey: true, target: input })).toBeNull();
    expect(shortcut({ ctrlKey: true, target: textarea })).toBeNull();
    expect(shortcut({ ctrlKey: true, target: select })).toBeNull();
    expect(shortcut({ ctrlKey: true, target: editable })).toBeNull();
  });
});
