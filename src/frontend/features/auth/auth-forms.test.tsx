import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInSocial: vi.fn(),
}));

vi.mock("./auth-client", () => ({
  authClient: {
    signIn: { social: mocks.signInSocial },
  },
}));

import { GoogleAuthButton } from "./google-auth-button";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("GoogleAuthButton", () => {
  it("starts Google OAuth with the dashboard callback", async () => {
    mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(screen.getByRole("button", { name: "Google로 계속하기" }));

    await waitFor(() =>
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/dashboard",
      }),
    );
  });

  it("shows a stable actionable error instead of provider internals", async () => {
    mocks.signInSocial.mockResolvedValue({
      data: null,
      error: { message: "provider detail" },
    });
    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(screen.getByRole("button", { name: "Google로 계속하기" }));

    expect(
      await screen.findByText("Google 로그인을 시작하지 못했습니다. 다시 시도해 주세요."),
    ).toBeInTheDocument();
  });
});
