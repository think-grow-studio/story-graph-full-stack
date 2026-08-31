import { describe, expect, it, vi } from "vitest";

import type { Board, GraphNode, NodeState, Scope } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { putNodeState } from "./put-node-state/put-node-state";

const nodeId = "00000000-0000-4000-8000-000000000001";
const scopeId = "00000000-0000-4000-8000-000000000010";

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
    id: scopeId,
    storyId: "story-1",
    name: "Chapter 10",
    description: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function nodeFixture(overrides: Partial<GraphNode> = {}): GraphNode {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    id: nodeId,
    storyId: "story-1",
    name: "Alice",
    description: "Knight",
    iconKey: null,
    properties: { age: 24 },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function nodeStateFixture(overrides: Partial<NodeState> = {}): NodeState {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    scopeId,
    nodeId,
    name: "Queen Alice",
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

function graph(input?: {
  scope?: Scope;
  node?: GraphNode;
  putResult?: NodeState | "conflict" | null;
}): GraphRepository {
  const scope = input?.scope ?? scopeFixture();
  const node = input?.node ?? nodeFixture();
  const board: Board = {
    id: "board-1",
    storyId: "story-1",
    scopeId,
    name: "Scoped",
    description: "",
    revision: 0,
    createdAt: new Date("2026-08-30T00:00:00.000Z"),
    updatedAt: new Date("2026-08-30T00:00:00.000Z"),
  };
  return {
    createScope: vi.fn(),
    listScopes: vi.fn(),
    findScope: vi.fn(async (id) => (id === scope.id ? scope : null)),
    createBoard: vi.fn(),
    listBoards: vi.fn(async () => [board]),
    findBoard: vi.fn(async () => board),
    listNodes: vi.fn(async () => [node]),
    findNode: vi.fn(async (id) => (id === node.id ? node : null)),
    findEdge: vi.fn(),
    getBoardSnapshot: vi.fn(),
    createNodeOnBoard: vi.fn(),
    placeNodeOnBoard: vi.fn(),
    putNodeState: vi.fn(async (request) =>
      input?.putResult === undefined
        ? nodeStateFixture({
            name: request.name,
            description: request.description,
            properties: request.properties,
            version: request.expectedVersion === null ? 1 : request.expectedVersion + 1,
          })
        : input.putResult,
    ),
    putEdgeState: vi.fn(),
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

describe("NodeState use-case", () => {
  it("creates first scoped state with version=null and preserves sparse null overrides", async () => {
    const story = storyFixture();
    const graphRepository = graph();
    const workspaceAccess = access();

    const result = await putNodeState(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        scopeId,
        nodeId,
        version: null,
        name: "Queen Alice",
        description: null,
        properties: null,
      },
      { stories: stories(story), graph: graphRepository, access: workspaceAccess },
    );

    expect(result).toMatchObject({
      scopeId,
      nodeId,
      name: "Queen Alice",
      description: null,
      properties: null,
      version: 1,
    });
    expect(graphRepository.putNodeState).toHaveBeenCalledWith({
      scopeId,
      nodeId,
      expectedVersion: null,
      name: "Queen Alice",
      description: null,
      properties: null,
    });
  });

  it("maps a stale compare-and-set write to HTTP 409 semantics", async () => {
    const story = storyFixture();
    const graphRepository = graph({ putResult: "conflict" });

    await expect(
      putNodeState(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          scopeId,
          nodeId,
          version: 3,
          name: null,
          description: "Changed",
          properties: null,
        },
        { stories: stories(story), graph: graphRepository, access: access() },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("hides a Node from another Story before graph:update", async () => {
    const story = storyFixture();
    const graphRepository = graph({ node: nodeFixture({ storyId: "story-2" }) });
    const workspaceAccess = access();

    await expect(
      putNodeState(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          scopeId,
          nodeId,
          version: null,
          name: "Invalid",
          description: null,
          properties: null,
        },
        { stories: stories(story), graph: graphRepository, access: workspaceAccess },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(workspaceAccess.requireCapability).not.toHaveBeenCalled();
    expect(graphRepository.putNodeState).not.toHaveBeenCalled();
  });
});