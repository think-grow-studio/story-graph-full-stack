import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getStory: vi.fn(),
  listBoards: vi.fn(),
  createBoard: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/story/story.api", () => ({
  getStory: mocks.getStory,
}));

vi.mock("@/frontend/api/graph/graph.api", () => ({
  listBoards: mocks.listBoards,
  createBoard: mocks.createBoard,
}));

import { StoryBoardsPage } from "./story-boards-page";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StoryBoardsPage storyId="11111111-1111-4111-8111-111111111111" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Writer's Workspace", slug: "personal-user-1" },
  });
  mocks.getStory.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "workspace-1",
    name: "My Novel",
    description: "World notes",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  });
  mocks.listBoards.mockResolvedValue([
    {
      id: "22222222-2222-4222-8222-222222222222",
      storyId: "11111111-1111-4111-8111-111111111111",
      name: "Characters",
      description: "",
      revision: 0,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  ]);
});

afterEach(cleanup);

describe("StoryBoardsPage", () => {
  it("loads the Story and links its Boards to the Editor", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "My Novel" })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "Characters" });
    expect(link).toHaveAttribute(
      "href",
      "/stories/11111111-1111-4111-8111-111111111111/boards/22222222-2222-4222-8222-222222222222",
    );
    expect(mocks.getStory).toHaveBeenCalledWith(
      "workspace-1",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mocks.listBoards).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "workspace-1",
    );
  });

  it("creates a Board in the current Story", async () => {
    mocks.createBoard.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      storyId: "11111111-1111-4111-8111-111111111111",
      name: "Plot",
      description: "",
      revision: 0,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.type(screen.getByLabelText("Board name"), "Plot");
    await user.click(screen.getByRole("button", { name: "Create Board" }));

    await waitFor(() =>
      expect(mocks.createBoard).toHaveBeenCalledWith({
        storyId: "11111111-1111-4111-8111-111111111111",
        workspaceId: "workspace-1",
        name: "Plot",
        description: "",
      }),
    );
  });
});
