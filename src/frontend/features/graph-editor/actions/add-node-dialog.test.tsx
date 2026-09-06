import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddNodeDialog } from "./add-node-dialog";

afterEach(cleanup);

describe("AddNodeDialog", () => {
  it("creates a new Node and clears action draft through close", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <AddNodeDialog
        busy={false}
        onClose={onClose}
        onCreate={onCreate}
        open
      />,
    );

    await user.type(screen.getByLabelText("노드 이름"), "Alice");
    await user.click(screen.getByRole("button", { name: "새 노드 만들기" }));

    expect(onCreate).toHaveBeenCalledWith("Alice");
  });

  it("has no API for placing Nodes from other Boards", () => {
    render(
      <AddNodeDialog
        busy={false}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        open
      />,
    );

    expect(screen.queryByLabelText("기존 노드")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "보드에 추가" })).not.toBeInTheDocument();
  });

  it("closes without submitting when cancelled", async () => {
    const onClose = vi.fn();
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <AddNodeDialog
        busy={false}
        onClose={onClose}
        onCreate={onCreate}
        open
      />,
    );

    await user.type(screen.getByLabelText("노드 이름"), "Draft");
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
