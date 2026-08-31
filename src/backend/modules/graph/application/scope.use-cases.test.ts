import { describe, expect, it, vi } from "vitest";

import type { Board, Scope } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createScope } from "./create-scope/create-scope";
import { listScopes } from "./list-scopes/list-scopes";

function storyFixture(overrides: Partial<Story> = {}): Story {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    id: "story-1",
    workspaceId: "workspace-1",
    name: "Story",
    description: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function scopeFixture(overrides: Partial<Scope> = {}): Scope {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    id: "scope-1",
    storyId: "story-1",
    name: "Chapter 10",
    description: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function boardFixture(): Board {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    id: "board-1",
    storyId: "story-1",
    scopeId: null,
    name: "Main",
    description: "",
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function stories(story: Story): StoryRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async (id) => (id === story.id ? story : null)),
    listByWorkspace: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function graph(scopeValue: Scope = scopeFixture()): GraphRepository {
  const boardValue = boardFixture();
  return {
    createScope: vi.fn(async (input) => ({ ...scopeValue, ...input })),
    listScopes: vi.fn(async () => [scopeValue]),
    findScope: vi.fn(async (id) => (id === scopeValue.id ? scopeValue : null)),
    createBoard: vi.fn(async (input) => ({ ...boardValue, ...input })),
    listBoards: vi.fn(async () => [boardValue]),
    findBoard: vi.fn(async () => boardValue),
    listNodes: vi.fn(async () => []),
    findNode: vi.fn(async () => null),
    findEdge: vi.fn(async () => null),
    getBoardSnapshot: vi.fn(async () => null),
    createNodeOnBoard: vi.fn(),
    placeNodeOnBoard: vi.fn(),
    putNodeState: vi.fn(),
    updateNode: vi.fn(),
    updateBoardNode: vi.fn(),
    removeNodeFromBoard: vi.fn(),
    restoreNodeToBoard: vi.fn(),
    createEdgeOnBoard: vi.fn(),
    updateEdge: vi.fn(),
    removeEdgeFromBoard: vi.fn(),
    restoreEdgeToBoard: vi.fn(),
  };
}

function access(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Scope use-cases", () => {
  it("creates a Scope after Story isolation and graph:update", async () => {
    const story = storyFixture();
    const graphRepository = graph();
    const workspaceAccess = access();

    const result = await createScope(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        name: "Chapter 10",
        description: "State boundary",
      },
      { stories: stories(story), graph: graphRepository, access: workspaceAccess },
    );

    expect(result).toMatchObject({ storyId: "story-1", name: "Chapter 10" });
    expect(workspaceAccess.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(graphRepository.createScope).toHaveBeenCalledWith({
      storyId: "story-1",
      name: "Chapter 10",
      description: "State boundary",
    });
  });

  it("lists Scopes with graph:read", async () => {
    const story = storyFixture();
    const graphRepository = graph();
    const workspaceAccess = access();

    const result = await listScopes(
      { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-1" },
      { stories: stories(story), graph: graphRepository, access: workspaceAccess },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Chapter 10");
    expect(workspaceAccess.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:read",
    });
  });

  it("hides cross-workspace Story before Scope authorization", async () => {
    const story = storyFixture({ workspaceId: "workspace-2" });
    const graphRepository = graph();
    const workspaceAccess = access();

    await expect(
      createScope(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          name: "Hidden",
          description: "",
        },
        { stories: stories(story), graph: graphRepository, access: workspaceAccess },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(workspaceAccess.requireCapability).not.toHaveBeenCalled();
    expect(graphRepository.createScope).not.toHaveBeenCalled();
  });
});