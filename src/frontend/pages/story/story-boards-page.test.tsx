import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";

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

const board = {
  id: boardId,
  storyId,
  name: "Characters",
  description: "",
  tags: ["인물", "전체"],
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue(bootstrap);
  mocks.getStory.mockResolvedValue(story);
  mocks.listScopes.mockResolvedValue([]);
  mocks.listBoards.mockResolvedValue([board]);
});

afterEach(cleanup);

describe("StoryBoardsPage", () => {
  it("shows independent Boards with their tags and no Context management", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "My Novel" })).toBeInTheDocument();
    expect(await screen.findByText("World notes")).toBeInTheDocument();
    expect(await screen.findByText("#인물")).toBeInTheDocument();
    expect(screen.getByText("#전체")).toBeInTheDocument();
    expect(screen.queryByText("컨텍스트")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "컨텍스트 관리" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Characters" })).toHaveAttribute(
      "href",
      `/stories/${storyId}/boards/${boardId}`,
    );
  });

  it("filters Boards by attached tag", async () => {
    mocks.listBoards.mockResolvedValue([
      board,
      {
        ...board,
        id: "33333333-3333-4333-8333-333333333333",
        name: "Plot Flow",
        tags: ["사건"],
      },
    ]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("link", { name: "Characters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plot Flow" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "#인물" }));

    expect(screen.getByRole("link", { name: "Characters" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plot Flow" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(screen.getByRole("link", { name: "Plot Flow" })).toBeInTheDocument();
  });

  it("explains the first Board when none exist", async () => {
    mocks.listBoards.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("아직 보드가 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "첫 보드 시작하기" })).toBeInTheDocument();
  });

  it("creates a Board with simple comma-separated tags and opens the editor", async () => {
    const createdBoard = {
      ...board,
      id: "44444444-4444-4444-8444-444444444444",
      name: "Plot",
      tags: ["사건", "1부"],
    };
    mocks.createBoard.mockResolvedValue(createdBoard);
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.click(screen.getByRole("button", { name: "새 보드" }));
    const dialog = screen.getByRole("dialog", { name: "새 보드" });
    expect(within(dialog).queryByLabelText("컨텍스트")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("보드 이름"), "Plot");
    await user.type(within(dialog).getByLabelText("태그"), "사건, #1부");
    await user.click(within(dialog).getByRole("button", { name: "보드 만들기" }));

    await waitFor(() =>
      expect(mocks.createBoard).toHaveBeenCalledWith({
        storyId,
        workspaceId: "workspace-1",
        name: "Plot",
        description: "",
        tags: ["사건", "1부"],
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith(
      `/stories/${storyId}/boards/${createdBoard.id}`,
    );
  });

  it("rejects duplicate tags before creating a Board", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "My Novel" });
    await user.click(screen.getByRole("button", { name: "새 보드" }));
    const dialog = screen.getByRole("dialog", { name: "새 보드" });
    await user.type(within(dialog).getByLabelText("보드 이름"), "People");
    await user.type(within(dialog).getByLabelText("태그"), "인물, #인물");
    await user.click(within(dialog).getByRole("button", { name: "보드 만들기" }));

    expect(await within(dialog).findByText("같은 태그를 두 번 붙일 수 없습니다.")).toBeInTheDocument();
    expect(mocks.createBoard).not.toHaveBeenCalled();
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
