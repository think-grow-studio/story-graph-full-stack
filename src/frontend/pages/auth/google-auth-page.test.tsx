import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/features/auth/google-auth-button", () => ({
  GoogleAuthButton: () => <button type="button">Google로 계속하기</button>,
}));

import { GoogleAuthPage } from "./google-auth-page";

function renderAuthPage(mode: "login" | "signup") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GoogleAuthPage mode={mode} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("GoogleAuthPage", () => {
  it("shows the login surface after bootstrap confirms there is no session", async () => {
    mocks.getBootstrap.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    renderAuthPage("login");

    expect(
      await screen.findByRole("heading", { name: "다시 만나서 반가워요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "처음 시작하기" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("shows the signup surface after bootstrap confirms there is no session", async () => {
    mocks.getBootstrap.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    renderAuthPage("signup");

    expect(
      await screen.findByRole("heading", { name: "이야기를 연결해 보세요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하기" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("redirects an already authenticated user to the dashboard", async () => {
    mocks.getBootstrap.mockResolvedValue({
      actor: { id: "user-1", email: "user@example.com", name: "Writer" },
      workspace: { id: "workspace-1", name: "Writer Workspace", slug: "writer" },
    });

    renderAuthPage("signup");

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("offers retry when bootstrap fails outside the unauthenticated case", async () => {
    mocks.getBootstrap
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 401 },
      });
    const user = userEvent.setup();

    renderAuthPage("login");

    await user.click(await screen.findByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { name: "다시 만나서 반가워요" }),
    ).toBeInTheDocument();
    expect(mocks.getBootstrap).toHaveBeenCalledTimes(2);
  });
});
