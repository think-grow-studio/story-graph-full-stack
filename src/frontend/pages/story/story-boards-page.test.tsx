import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const scopeId = "44444444-4444-4444-8444-444444444444";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getStory: vi.fn(),
  listBoards: vi.fn(),
  createBoard: vi.fn(),
  listScopes: vi.fn(),
  createScope: vi.fn(),
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
  listScopes: mocks.listScopes,
  createScope: mocks.createScope,
}));

import { StoryBoardsPage } from "./story-boards-page";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StoryBoardsPage storyId={storyId} />
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
    id: storyId,
    workspaceId: "workspace-1",
    name: "My Novel",
    description: "World notes",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  });
  mocks.listScopes.mockResolvedValue([
    {
      id: scopeId,
      storyId,
      name: "Chapter 10",
      description: "",
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  ]);
  mocks.listBoards.mockResolvedValue([
    {
      id: boardId,
      storyId,
      scopeId,
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
      `/stories/${storyId}/boards/${boardId}`,
    );
    expect(mocks.getStory).toHaveBeenCalledWith("workspace-1", storyId);
    expect(mocks.listBoards).toHaveBeenCalledWith(storyId, "workspace-1");
  });

  it("renders Scopes and joins a Board card to its Scope", async () => {
    renderPage();

    expect(await screen.findByText("Chapter 10")).toBeInTheDocument();
    expect(await screen.findByText("Scope: Chapter 10")).toBeInTheDocument();
    expect(mocks.listScopes).toHaveBeenCalledWith(storyId, "workspace-1");
  });

  it("creates a Scope in the current Story", async () => {
    mocks.createScope.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      storyId,
      name: "Chapter 20",
      description: "",
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.type(screen.getByLabelText("Scope name"), "Chapter 20");
    await user.click(screen.getByRole("button", { name: "Create Scope" }));

    await waitFor(() =>
      expect(mocks.createScope).toHaveBeenCalledWith({
        storyId,
        workspaceId: "workspace-1",
        name: "Chapter 20",
        description: "",
      }),
    );
  });

  it("creates an unscoped Board by default", async () => {
    mocks.createBoard.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      storyId,
      scopeId: null,
      name: "Plot",
      description: "",
      revision: 0,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    expect(screen.getByLabelText("Board scope")).toHaveValue("");
    await user.type(screen.getByLabelText("Board name"), "Plot");
    await user.click(screen.getByRole("button", { name: "Create Board" }));

    await waitFor(() =>
      expect(mocks.createBoard).toHaveBeenCalledWith({
        storyId,
        workspaceId: "workspace-1",
        scopeId: null,
        name: "Plot",
        description: "",
      }),
    );
  });

  it("creates a Board in the selected Scope", async () => {
    mocks.createBoard.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      storyId,
      scopeId,
      name: "Chapter Characters",
      description: "",
      revision: 0,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.selectOptions(screen.getByLabelText("Board scope"), scopeId);
    await user.type(screen.getByLabelText("Board name"), "Chapter Characters");
    await user.click(screen.getByRole("button", { name: "Create Board" }));

    await waitFor(() =>
      expect(mocks.createBoard).toHaveBeenCalledWith({
        storyId,
        workspaceId: "workspace-1",
        scopeId,
        name: "Chapter Characters",
        description: "",
      }),
    );
  });
});