import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  listStories: vi.fn(),
  createStory: vi.fn(),
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
  listStories: mocks.listStories,
  createStory: mocks.createStory,
}));

vi.mock("@/frontend/features/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">로그아웃</button>,
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

const bootstrap = {
  actor: { id: "user-1", email: "writer@example.com", name: "Writer" },
  workspace: { id: "workspace-1", name: "Writer Workspace", slug: "writer" },
};

const existingStory = {
  id: "story-1",
  workspaceId: "workspace-1",
  name: "Existing Story",
  description: "첫 번째 장편 이야기",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue(bootstrap);
  mocks.listStories.mockResolvedValue([existingStory]);
});

afterEach(cleanup);

describe("DashboardPage", () => {
  it("shows the product dashboard and links existing stories", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "내 이야기" })).toBeInTheDocument();
    expect(await screen.findByText("첫 번째 장편 이야기")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Existing Story" })).toHaveAttribute(
      "href",
      "/stories/story-1",
    );
  });

  it("turns an empty workspace into a clear first action", async () => {
    mocks.listStories.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByText("아직 이야기가 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "첫 이야기 만들기" })).toBeInTheDocument();
  });

  it("creates a story in a dialog and opens the returned story", async () => {
    mocks.createStory.mockResolvedValue({
      ...existingStory,
      id: "story-2",
      name: "My First Story",
      description: "A connected world",
    });
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByRole("heading", { name: "내 이야기" });
    await user.click(screen.getByRole("button", { name: "새 이야기" }));
    await user.type(screen.getByLabelText("이야기 이름"), "My First Story");
    await user.type(screen.getByLabelText("설명"), "A connected world");
    await user.click(screen.getByRole("button", { name: "이야기 만들기" }));

    await waitFor(() =>
      expect(mocks.createStory).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        name: "My First Story",
        description: "A connected world",
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/stories/story-2");
  });

  it("keeps story name required before creation", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByRole("heading", { name: "내 이야기" });
    await user.click(screen.getByRole("button", { name: "새 이야기" }));
    await user.click(screen.getByRole("button", { name: "이야기 만들기" }));

    expect(await screen.findByText("이야기 이름을 입력해 주세요.")).toBeInTheDocument();
    expect(mocks.createStory).not.toHaveBeenCalled();
  });

  it("offers recovery when the story list cannot be loaded", async () => {
    mocks.listStories
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([existingStory]);
    const user = userEvent.setup();
    renderDashboard();

    expect(
      await screen.findByText("이야기를 불러오지 못했습니다. 다시 시도해 주세요."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByRole("link", { name: "Existing Story" })).toBeInTheDocument();
    expect(mocks.listStories).toHaveBeenCalledTimes(2);
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
