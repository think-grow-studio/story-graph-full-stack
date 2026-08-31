import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Dialog } from "./dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        열기
      </button>
      <Dialog
        description="새 이야기의 이름을 입력하세요."
        onClose={() => setOpen(false)}
        open={open}
        title="새 이야기"
      >
        <button type="button">이야기 만들기</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens as an accessible modal and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "열기" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "새 이야기" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("새 이야기의 이름을 입력하세요.")).toBeVisible();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "새 이야기" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
