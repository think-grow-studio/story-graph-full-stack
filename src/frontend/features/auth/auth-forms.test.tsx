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

afterEach(() => {
  cleanup();
});

describe("GoogleAuthButton", () => {
  it("starts the Google OAuth flow with the dashboard callback", async () => {
    mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/dashboard",
      }),
    );
  });

  it("shows an auth error returned by Better Auth", async () => {
    mocks.signInSocial.mockResolvedValue({
      data: null,
      error: { message: "Google sign-in failed" },
    });
    const user = userEvent.setup();
    render(<GoogleAuthButton />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByText("Google sign-in failed")).toBeInTheDocument();
  });
});
