import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  listStories: vi.fn(),
  createStory: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/story/story.api", () => ({
  listStories: mocks.listStories,
  createStory: mocks.createStory,
}));

import { DashboardPage } from "./dashboard-page";

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Google User" },
    workspace: { id: "workspace-1", name: "Google User's Workspace", slug: "personal-user-1" },
  });
  mocks.listStories.mockResolvedValue([
    {
      id: "story-1",
      workspaceId: "workspace-1",
      name: "Existing Story",
      description: "",
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  ]);
});

afterEach(() => {
  cleanup();
});

describe("DashboardPage", () => {
  it("shows the personal workspace and Stories after bootstrap", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Google User's Workspace" })).toBeInTheDocument();
    expect(await screen.findByText("Existing Story")).toBeInTheDocument();
    expect(mocks.listStories).toHaveBeenCalledWith("workspace-1");
  });

  it("creates a Story in the bootstrapped workspace", async () => {
    mocks.createStory.mockResolvedValue({
      id: "story-2",
      workspaceId: "workspace-1",
      name: "My First Story",
      description: "",
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByRole("heading", { name: "Google User's Workspace" });
    await user.type(screen.getByLabelText("Story name"), "My First Story");
    await user.click(screen.getByRole("button", { name: "Create Story" }));

    await waitFor(() =>
      expect(mocks.createStory).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        name: "My First Story",
        description: "",
      }),
    );
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.getBootstrap.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });
    renderDashboard();

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  });
});
