import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";

const modulePaths = {
  create: "./create-edge/create-edge",
  list: "./list-edges/list-edges",
  get: "./get-edge/get-edge",
  update: "./update-edge/update-edge",
  delete: "./delete-edge/delete-edge",
} as const;

type TestGraphNode = {
  id: string;
  storyId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type TestGraphEdge = {
  id: string;
  storyId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type UpdateEdgeInput = {
  id: string;
  expectedVersion: number;
  name?: string;
  description?: string;
  iconKey?: string | null;
  properties?: Record<string, unknown>;
};

type UpdateEdgeResult =
  | { kind: "updated"; edge: TestGraphEdge }
  | { kind: "conflict" }
  | { kind: "not-found" };

type GraphDependencies = {
  graph: FakeGraphRepository;
  stories: FakeStoryRepository;
  access: WorkspaceAccessService;
};

type EdgeModule = {
  createEdge?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphEdge>;
  listEdges?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphEdge[]>;
  getEdge?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphEdge>;
  updateEdge?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphEdge>;
  deleteEdge?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<void>;
};

async function loadEdgeModule(path: string): Promise<EdgeModule | null> {
  return vi.importActual<EdgeModule>(path).catch(() => null);
}

class FakeStoryRepository implements StoryRepository {
  stories = new Map<string, Story>();

  async create(story: Story) {
    this.stories.set(story.id, story);
    return story;
  }

  async findById(id: string) {
    return this.stories.get(id) ?? null;
  }

  async listByWorkspace(workspaceId: string) {
    return [...this.stories.values()].filter((story) => story.workspaceId === workspaceId);
  }

  async update(): Promise<Story | null> {
    throw new Error("not used");
  }

  async delete(): Promise<boolean> {
    throw new Error("not used");
  }
}

class FakeGraphRepository {
  nodes = new Map<string, TestGraphNode>();
  edges = new Map<string, TestGraphEdge>();

  async createNode(node: TestGraphNode) {
    this.nodes.set(node.id, node);
    return node;
  }

  async findNodeById(id: string) {
    return this.nodes.get(id) ?? null;
  }

  async createEdge(edge: TestGraphEdge) {
    this.edges.set(edge.id, edge);
    return edge;
  }

  async findEdgeById(id: string) {
    return this.edges.get(id) ?? null;
  }

  async listEdgesByStory(storyId: string) {
    return [...this.edges.values()].filter((edge) => edge.storyId === storyId);
  }

  async updateEdge(input: UpdateEdgeInput): Promise<UpdateEdgeResult> {
    const current = this.edges.get(input.id);
    if (!current) return { kind: "not-found" };
    if (current.version !== input.expectedVersion) return { kind: "conflict" };

    const updated: TestGraphEdge = {
      ...current,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.iconKey === undefined ? {} : { iconKey: input.iconKey }),
      ...(input.properties === undefined ? {} : { properties: input.properties }),
      version: current.version + 1,
      updatedAt: new Date(),
    };
    this.edges.set(input.id, updated);
    return { kind: "updated", edge: updated };
  }

  async deleteEdge(id: string) {
    return this.edges.delete(id);
  }
}

function storyFixture(overrides: Partial<Story> = {}): Story {
  const now = new Date("2026-08-28T00:00:00.000Z");
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

function nodeFixture(overrides: Partial<TestGraphNode> = {}): TestGraphNode {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: crypto.randomUUID(),
    storyId: "story-1",
    name: "Node",
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createAccess(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Graph Edge use-cases", () => {
  let stories: FakeStoryRepository;
  let graph: FakeGraphRepository;
  let access: WorkspaceAccessService;

  beforeEach(async () => {
    stories = new FakeStoryRepository();
    graph = new FakeGraphRepository();
    access = createAccess();
    await stories.create(storyFixture());
    await graph.createNode(nodeFixture({ id: "node-a" }));
    await graph.createNode(nodeFixture({ id: "node-b" }));
  });

  it("allows duplicate directed edges, reverse edges, and self-edges", async () => {
    const imported = await loadEdgeModule(modulePaths.create);
    expect(imported?.createEdge).toBeTypeOf("function");
    if (!imported?.createEdge) return;

    const create = (id: string, sourceNodeId: string, targetNodeId: string) =>
      imported.createEdge!(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          id,
          sourceNodeId,
          targetNodeId,
          name: "knows",
          description: "",
          iconKey: null,
          properties: { strength: 1 },
        },
        { graph, stories, access },
      );

    await create("edge-1", "node-a", "node-b");
    await create("edge-2", "node-a", "node-b");
    await create("edge-3", "node-b", "node-a");
    await create("edge-4", "node-a", "node-a");

    expect([...graph.edges.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "edge-1", sourceNodeId: "node-a", targetNodeId: "node-b" }),
        expect.objectContaining({ id: "edge-2", sourceNodeId: "node-a", targetNodeId: "node-b" }),
        expect.objectContaining({ id: "edge-3", sourceNodeId: "node-b", targetNodeId: "node-a" }),
        expect.objectContaining({ id: "edge-4", sourceNodeId: "node-a", targetNodeId: "node-a" }),
      ]),
    );
    expect(access.requireCapability).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "graph:update" }),
    );
  });

  it("rejects an Edge when either endpoint belongs to another Story", async () => {
    const imported = await loadEdgeModule(modulePaths.create);
    expect(imported?.createEdge).toBeTypeOf("function");
    if (!imported?.createEdge) return;

    await graph.createNode(nodeFixture({ id: "foreign", storyId: "story-2" }));

    await expect(
      imported.createEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          id: "edge-bad-source",
          sourceNodeId: "foreign",
          targetNodeId: "node-a",
          name: "invalid",
          description: "",
          iconKey: null,
          properties: {},
        },
        { graph, stories, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    await expect(
      imported.createEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          id: "edge-bad-target",
          sourceNodeId: "node-a",
          targetNodeId: "foreign",
          name: "invalid",
          description: "",
          iconKey: null,
          properties: {},
        },
        { graph, stories, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(graph.edges.size).toBe(0);
  });

  it("lists and gets only Edges from the requested Story", async () => {
    const createImported = await loadEdgeModule(modulePaths.create);
    const listImported = await loadEdgeModule(modulePaths.list);
    const getImported = await loadEdgeModule(modulePaths.get);
    expect(createImported?.createEdge).toBeTypeOf("function");
    expect(listImported?.listEdges).toBeTypeOf("function");
    expect(getImported?.getEdge).toBeTypeOf("function");
    if (!createImported?.createEdge || !listImported?.listEdges || !getImported?.getEdge) return;

    const edge = await createImported.createEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        id: "edge-1",
        sourceNodeId: "node-a",
        targetNodeId: "node-b",
        name: "knows",
        description: "",
        iconKey: null,
        properties: {},
      },
      { graph, stories, access },
    );

    const listed = await listImported.listEdges(
      { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-1" },
      { graph, stories, access },
    );
    expect(listed.map((item) => item.id)).toEqual([edge.id]);

    const found = await getImported.getEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        edgeId: edge.id,
      },
      { graph, stories, access },
    );
    expect(found.id).toBe(edge.id);
    expect(access.requireCapability).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "graph:read" }),
    );
  });

  it("updates Edge metadata with optimistic locking and rejects stale versions", async () => {
    const createImported = await loadEdgeModule(modulePaths.create);
    const updateImported = await loadEdgeModule(modulePaths.update);
    expect(createImported?.createEdge).toBeTypeOf("function");
    expect(updateImported?.updateEdge).toBeTypeOf("function");
    if (!createImported?.createEdge || !updateImported?.updateEdge) return;

    await createImported.createEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        id: "edge-1",
        sourceNodeId: "node-a",
        targetNodeId: "node-b",
        name: "knows",
        description: "",
        iconKey: null,
        properties: {},
      },
      { graph, stories, access },
    );

    const updated = await updateImported.updateEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        edgeId: "edge-1",
        expectedVersion: 1,
        name: "trusts",
        properties: { strength: 2 },
      },
      { graph, stories, access },
    );
    expect(updated).toMatchObject({ name: "trusts", properties: { strength: 2 }, version: 2 });

    await expect(
      updateImported.updateEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          edgeId: "edge-1",
          expectedVersion: 1,
          description: "stale",
        },
        { graph, stories, access },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("deletes an Edge and returns NOT_FOUND for an unknown Edge", async () => {
    const createImported = await loadEdgeModule(modulePaths.create);
    const deleteImported = await loadEdgeModule(modulePaths.delete);
    expect(createImported?.createEdge).toBeTypeOf("function");
    expect(deleteImported?.deleteEdge).toBeTypeOf("function");
    if (!createImported?.createEdge || !deleteImported?.deleteEdge) return;

    await createImported.createEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        id: "edge-1",
        sourceNodeId: "node-a",
        targetNodeId: "node-b",
        name: "knows",
        description: "",
        iconKey: null,
        properties: {},
      },
      { graph, stories, access },
    );

    await expect(
      deleteImported.deleteEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          edgeId: "edge-1",
        },
        { graph, stories, access },
      ),
    ).resolves.toBeUndefined();

    await expect(
      deleteImported.deleteEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          edgeId: "missing",
        },
        { graph, stories, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
