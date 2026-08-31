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
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
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

vi.mock("@/frontend/features/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">로그아웃</button>,
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

const bootstrap = {
  actor: { id: "user-1", email: "writer@example.com", name: "Writer" },
  workspace: { id: "workspace-1", name: "Writer Workspace", slug: "writer" },
};

const story = {
  id: storyId,
  workspaceId: "workspace-1",
  name: "My Novel",
  description: "World notes",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const scope = {
  id: scopeId,
  storyId,
  name: "Chapter 10",
  description: "",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const board = {
  id: boardId,
  storyId,
  scopeId,
  name: "Characters",
  description: "",
  revision: 0,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue(bootstrap);
  mocks.getStory.mockResolvedValue(story);
  mocks.listScopes.mockResolvedValue([scope]);
  mocks.listBoards.mockResolvedValue([board]);
});

afterEach(cleanup);

describe("StoryBoardsPage", () => {
  it("makes Boards primary and shows attached context", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "My Novel" })).toBeInTheDocument();
    expect(screen.getByText("World notes")).toBeInTheDocument();
    expect(screen.getByText("컨텍스트: Chapter 10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Characters" })).toHaveAttribute(
      "href",
      `/stories/${storyId}/boards/${boardId}`,
    );
  });

  it("explains the first Board when none exist", async () => {
    mocks.listBoards.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("아직 보드가 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "첫 보드 만들기" })).toBeInTheDocument();
  });

  it("creates an unscoped Board and opens the returned editor", async () => {
    const createdBoard = { ...board, id: "33333333-3333-4333-8333-333333333333", scopeId: null, name: "Plot" };
    mocks.createBoard.mockResolvedValue(createdBoard);
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.click(screen.getByRole("button", { name: "새 보드" }));
    expect(screen.getByLabelText("컨텍스트")).toHaveValue("");
    await user.type(screen.getByLabelText("보드 이름"), "Plot");
    await user.click(screen.getByRole("button", { name: "보드 만들기" }));

    await waitFor(() =>
      expect(mocks.createBoard).toHaveBeenCalledWith({
        storyId,
        workspaceId: "workspace-1",
        scopeId: null,
        name: "Plot",
        description: "",
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith(
      `/stories/${storyId}/boards/${createdBoard.id}`,
    );
  });

  it("creates a Board in the selected context", async () => {
    mocks.createBoard.mockResolvedValue({ ...board, name: "Chapter Characters" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.click(screen.getByRole("button", { name: "새 보드" }));
    await user.selectOptions(screen.getByLabelText("컨텍스트"), scopeId);
    await user.type(screen.getByLabelText("보드 이름"), "Chapter Characters");
    await user.click(screen.getByRole("button", { name: "보드 만들기" }));

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

  it("keeps context management secondary but usable", async () => {
    mocks.createScope.mockResolvedValue({ ...scope, id: "scope-2", name: "Chapter 20" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.click(screen.getByRole("button", { name: "컨텍스트 관리" }));
    await user.type(screen.getByLabelText("컨텍스트 이름"), "Chapter 20");
    await user.click(screen.getByRole("button", { name: "컨텍스트 만들기" }));

    await waitFor(() =>
      expect(mocks.createScope).toHaveBeenCalledWith({
        storyId,
        workspaceId: "workspace-1",
        name: "Chapter 20",
        description: "",
      }),
    );
  });

  it("redirects an expired session to login", async () => {
    mocks.getBootstrap.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });
    renderPage();

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  });
});
