import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

  it("redirects an already authenticated user to the dashboard", async () => {
    mocks.getBootstrap.mockResolvedValue({
      actor: { id: "user-1", email: "user@example.com", name: "Writer" },
      workspace: { id: "workspace-1", name: "Writer Workspace", slug: "writer" },
    });

    renderAuthPage("signup");

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
  });
});
