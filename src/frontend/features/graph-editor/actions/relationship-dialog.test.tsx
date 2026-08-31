import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RelationshipDialog } from "./relationship-dialog";

afterEach(cleanup);

describe("RelationshipDialog", () => {
  it("submits a trimmed Relationship name", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <RelationshipDialog
        busy={false}
        onClose={vi.fn()}
        onCreate={onCreate}
        open
        sourceLabel="Alice"
        targetLabel="Bob"
      />,
    );

    expect(screen.getByText("Alice → Bob")).toBeInTheDocument();
    await user.type(screen.getByLabelText("관계 이름"), "  친구  ");
    await user.click(screen.getByRole("button", { name: "관계 만들기" }));

    expect(onCreate).toHaveBeenCalledWith("친구");
  });

  it("closes without creating a Relationship", async () => {
    const onClose = vi.fn();
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <RelationshipDialog
        busy={false}
        onClose={onClose}
        onCreate={onCreate}
        open
        sourceLabel="Alice"
        targetLabel="Bob"
      />,
    );

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
