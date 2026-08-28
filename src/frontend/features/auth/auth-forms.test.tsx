import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  getBootstrap: vi.fn(),
  push: vi.fn(),
}));

vi.mock("./auth-client", () => ({
  authClient: {
    signIn: { email: mocks.signInEmail },
    signUp: { email: mocks.signUpEmail },
  },
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "writer@example.com", name: "writer" },
    workspace: { id: "workspace-1", name: "writer's Workspace", slug: "workspace-1" },
  });
});

describe("LoginForm", () => {
  it("validates email and password before submitting", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter a valid email." )).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters." )).toBeInTheDocument();
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("signs in, bootstraps, and navigates to the dashboard", async () => {
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "writer@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.signInEmail).toHaveBeenCalled());
    expect(mocks.getBootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/dashboard");
  });
});

describe("SignupForm", () => {
  it("signs up with email/password, bootstraps, and navigates", async () => {
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Email"), "new-writer@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.signUpEmail).toHaveBeenCalledWith({
      email: "new-writer@example.com",
      password: "Password123!",
      name: "new-writer",
    }));
    expect(mocks.getBootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/dashboard");
  });
});
