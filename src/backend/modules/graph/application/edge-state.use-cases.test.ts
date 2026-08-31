import { describe, expect, it, vi } from "vitest";

import type { Board, EdgeState, GraphEdge, GraphNode, Scope } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { putEdgeState } from "./put-edge-state/put-edge-state";

const edgeId = "00000000-0000-4000-8000-000000000101";
const scopeId = "00000000-0000-4000-8000-000000000110";

function storyFixture(overrides: Partial<Story> = {}): Story {
  const now = new Date("2026-08-31T00:00:00.000Z");
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
  const now = new Date("2026-08-31T00:00:00.000Z");
  return {
    id: scopeId,
    storyId: "story-1",
    name: "Chapter 10",
    description: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function edgeFixture(overrides: Partial<GraphEdge> = {}): GraphEdge {
  const now = new Date("2026-08-31T00:00:00.000Z");
  return {
    id: edgeId,
    storyId: "story-1",
    sourceNodeId: "00000000-0000-4000-8000-000000000001",
    targetNodeId: "00000000-0000-4000-8000-000000000002",
    name: "serves",
    description: "Alice serves the Crown",
    iconKey: null,
    properties: { trust: 4 },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function edgeStateFixture(overrides: Partial<EdgeState> = {}): EdgeState {
  const now = new Date("2026-08-31T00:00:00.000Z");
  return {
    scopeId,
    edgeId,
    name: "rules",
    description: null,
    properties: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
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

type EdgeStateGraphRepository = GraphRepository & {
  putEdgeState: ReturnType<typeof vi.fn>;
};

function graph(input?: {
  scope?: Scope;
  edge?: GraphEdge;
  putResult?: EdgeState | "conflict" | null;
}): EdgeStateGraphRepository {
  const foundScope = input?.scope ?? scopeFixture();
  const foundEdge = input?.edge ?? edgeFixture();
  const board: Board = {
    id: "board-1",
    storyId: "story-1",
    scopeId,
    name: "Scoped",
    description: "",
    revision: 0,
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
  };
  const repository = {
    createScope: vi.fn(),
    listScopes: vi.fn(),
    findScope: vi.fn(async (id: string) => (id === foundScope.id ? foundScope : null)),
    createBoard: vi.fn(),
    listBoards: vi.fn(async () => [board]),
    findBoard: vi.fn(async () => board),
    listNodes: vi.fn(async () => [] as GraphNode[]),
    findNode: vi.fn(),
    findEdge: vi.fn(async (id: string) => (id === foundEdge.id ? foundEdge : null)),
    getBoardSnapshot: vi.fn(),
    createNodeOnBoard: vi.fn(),
    placeNodeOnBoard: vi.fn(),
    putNodeState: vi.fn(),
    putEdgeState: vi.fn(async (request) =>
      input?.putResult === undefined
        ? edgeStateFixture({
            name: request.name,
            description: request.description,
            properties: request.properties,
            version: request.expectedVersion === null ? 1 : request.expectedVersion + 1,
          })
        : input.putResult,
    ),
    updateNode: vi.fn(),
    updateBoardNode: vi.fn(),
    removeNodeFromBoard: vi.fn(),
    restoreNodeToBoard: vi.fn(),
    createEdgeOnBoard: vi.fn(),
    updateEdge: vi.fn(),
    removeEdgeFromBoard: vi.fn(),
    restoreEdgeToBoard: vi.fn(),
  };
  return repository as unknown as EdgeStateGraphRepository;
}

function access(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

describe("EdgeState use-case", () => {
  it("creates first scoped state with a complete sparse payload", async () => {
    const story = storyFixture();
    const graphRepository = graph();

    const result = await putEdgeState(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        scopeId,
        edgeId,
        version: null,
        name: "rules",
        description: null,
        properties: null,
      },
      { stories: stories(story), graph: graphRepository, access: access() },
    );

    expect(result).toMatchObject({ scopeId, edgeId, name: "rules", version: 1 });
    expect(graphRepository.putEdgeState).toHaveBeenCalledWith({
      scopeId,
      edgeId,
      expectedVersion: null,
      name: "rules",
      description: null,
      properties: null,
    });
  });

  it("maps a stale compare-and-set write to HTTP 409 semantics", async () => {
    const story = storyFixture();

    await expect(
      putEdgeState(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          scopeId,
          edgeId,
          version: 3,
          name: null,
          description: "Changed",
          properties: null,
        },
        { stories: stories(story), graph: graph({ putResult: "conflict" }), access: access() },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("hides an Edge from another Story before graph:update", async () => {
    const story = storyFixture();
    const graphRepository = graph({ edge: edgeFixture({ storyId: "story-2" }) });
    const workspaceAccess = access();

    await expect(
      putEdgeState(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          scopeId,
          edgeId,
          version: null,
          name: "Invalid",
          description: null,
          properties: null,
        },
        { stories: stories(story), graph: graphRepository, access: workspaceAccess },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(workspaceAccess.requireCapability).not.toHaveBeenCalled();
    expect(graphRepository.putEdgeState).not.toHaveBeenCalled();
  });
});
