import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/frontend/features/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">로그아웃</button>,
}));

import { AppShell } from "./app-shell";

afterEach(cleanup);

describe("AppShell", () => {
  it("keeps the real product navigation and account controls reachable", async () => {
    const user = userEvent.setup();

    render(
      <AppShell
        actor={{ id: "user-1", email: "writer@example.com", name: "Writer" }}
        title="내 이야기"
      >
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { name: "내 이야기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 이야기" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByText("Writer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "메뉴 열기" }));

    expect(screen.getByRole("dialog", { name: "메뉴" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "로그아웃" }).length).toBeGreaterThan(0);
  });
});
