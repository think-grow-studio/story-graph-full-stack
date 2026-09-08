import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RelationshipDialog } from "./relationship-dialog";

afterEach(cleanup);

const sourceNodeId = "11111111-1111-4111-8111-111111111111";
const targetNodeId = "22222222-2222-4222-8222-222222222222";

type RelationshipDraftResult = {
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  direction: "DIRECTED" | "UNDIRECTED";
};

type DialogSpies = {
  onClose: ReturnType<typeof vi.fn<() => void>>;
  onCreate: ReturnType<typeof vi.fn<(result: RelationshipDraftResult) => void>>;
};

function renderDialog({
  onClose = vi.fn<() => void>(),
  onCreate = vi.fn<(result: RelationshipDraftResult) => void>(),
}: Partial<DialogSpies> = {}) {
  render(
    <RelationshipDialog
      busy={false}
      onClose={onClose}
      onCreate={onCreate}
      open
      sourceLabel="Alice"
      sourceNodeId={sourceNodeId}
      targetLabel="Bob"
      targetNodeId={targetNodeId}
    />,
  );

  return { onClose, onCreate };
}

describe("RelationshipDialog", () => {
  it("defaults to a directed A → B relationship and submits the complete draft", async () => {
    const onCreate = vi.fn<(result: RelationshipDraftResult) => void>();
    const user = userEvent.setup();
    renderDialog({ onCreate });

    expect(screen.getByText("Alice → Bob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "방향 있음" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.type(screen.getByLabelText("관계 이름"), "  친구  ");
    await user.click(screen.getByRole("button", { name: "관계 만들기" }));

    expect(onCreate).toHaveBeenCalledWith({
      sourceNodeId,
      targetNodeId,
      name: "친구",
      direction: "DIRECTED",
    });
  });

  it("supports an undirected A — B relationship", async () => {
    const onCreate = vi.fn<(result: RelationshipDraftResult) => void>();
    const user = userEvent.setup();
    renderDialog({ onCreate });

    await user.click(screen.getByRole("button", { name: "방향 없음" }));

    expect(screen.getByText("Alice — Bob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "방향 없음" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.type(screen.getByLabelText("관계 이름"), "형제");
    await user.click(screen.getByRole("button", { name: "관계 만들기" }));

    expect(onCreate).toHaveBeenCalledWith({
      sourceNodeId,
      targetNodeId,
      name: "형제",
      direction: "UNDIRECTED",
    });
  });

  it("swaps semantic source and target before creation", async () => {
    const onCreate = vi.fn<(result: RelationshipDraftResult) => void>();
    const user = userEvent.setup();
    renderDialog({ onCreate });

    await user.click(screen.getByRole("button", { name: "방향 바꾸기" }));
    expect(screen.getByText("Bob → Alice")).toBeInTheDocument();

    await user.type(screen.getByLabelText("관계 이름"), "보호한다");
    await user.click(screen.getByRole("button", { name: "관계 만들기" }));

    expect(onCreate).toHaveBeenCalledWith({
      sourceNodeId: targetNodeId,
      targetNodeId: sourceNodeId,
      name: "보호한다",
      direction: "DIRECTED",
    });
  });

  it("closes on cancel or Escape without creating a Relationship", async () => {
    const onClose = vi.fn<() => void>();
    const onCreate = vi.fn<(result: RelationshipDraftResult) => void>();
    const user = userEvent.setup();
    renderDialog({ onClose, onCreate });

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();

    cleanup();
    renderDialog({ onClose, onCreate });
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
