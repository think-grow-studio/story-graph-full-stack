import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("./auth-client", () => ({
  authClient: {
    signOut: mocks.signOut,
  },
}));

import { LogoutButton } from "./logout-button";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ data: {}, error: null });
});

afterEach(cleanup);

describe("LogoutButton", () => {
  it("signs out, clears authenticated query state, and returns home", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["bootstrap"], { actor: { id: "user-1" } });
    queryClient.setQueryData(["stories", "workspace-1"], [{ id: "story-1" }]);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <LogoutButton />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(["bootstrap"])).toBeUndefined();
    expect(queryClient.getQueryData(["stories", "workspace-1"])).toBeUndefined();
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
