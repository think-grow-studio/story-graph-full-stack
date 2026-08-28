import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationError } from "@/backend/common/errors/application-error";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";

const modulePaths = {
  create: "./create-node/create-node",
  list: "./list-nodes/list-nodes",
  get: "./get-node/get-node",
  update: "./update-node/update-node",
  delete: "./delete-node/delete-node",
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

type UpdateNodeInput = {
  id: string;
  expectedVersion: number;
  name?: string;
  description?: string;
  iconKey?: string | null;
  properties?: Record<string, unknown>;
};

type UpdateNodeResult =
  | { kind: "updated"; node: TestGraphNode }
  | { kind: "conflict" }
  | { kind: "not-found" };

type GraphDependencies = {
  graph: FakeGraphRepository;
  stories: FakeStoryRepository;
  access: WorkspaceAccessService;
};

type GraphModule = {
  createNode?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphNode>;
  listNodes?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphNode[]>;
  getNode?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphNode>;
  updateNode?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<TestGraphNode>;
  deleteNode?: (
    input: Record<string, unknown>,
    dependencies: GraphDependencies,
  ) => Promise<void>;
};

async function loadGraphModule(path: string): Promise<GraphModule | null> {
  return vi.importActual<GraphModule>(path).catch(() => null);
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

  async update() {
    throw new Error("not used");
  }

  async delete() {
    throw new Error("not used");
  }
}

class FakeGraphRepository {
  nodes = new Map<string, TestGraphNode>();

  async createNode(node: TestGraphNode) {
    this.nodes.set(node.id, node);
    return node;
  }

  async findNodeById(id: string) {
    return this.nodes.get(id) ?? null;
  }

  async listNodesByStory(storyId: string) {
    return [...this.nodes.values()].filter((node) => node.storyId === storyId);
  }

  async updateNode(input: UpdateNodeInput): Promise<UpdateNodeResult> {
    const current = this.nodes.get(input.id);
    if (!current) return { kind: "not-found" };
    if (current.version !== input.expectedVersion) return { kind: "conflict" };

    const updated: TestGraphNode = {
      ...current,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.iconKey === undefined ? {} : { iconKey: input.iconKey }),
      ...(input.properties === undefined ? {} : { properties: input.properties }),
      version: current.version + 1,
      updatedAt: new Date(),
    };
    this.nodes.set(input.id, updated);
    return { kind: "updated", node: updated };
  }

  async deleteNode(id: string) {
    return this.nodes.delete(id);
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
    name: "Alice",
    description: "Protagonist",
    iconKey: null,
    properties: { age: 27 },
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

describe("Graph Node use-cases", () => {
  let stories: FakeStoryRepository;
  let graph: FakeGraphRepository;
  let access: WorkspaceAccessService;

  beforeEach(async () => {
    stories = new FakeStoryRepository();
    graph = new FakeGraphRepository();
    access = createAccess();
    await stories.create(storyFixture());
  });

  it("creates a canonical Node with the client supplied ID and version 1", async () => {
    const imported = await loadGraphModule(modulePaths.create);
    expect(imported?.createNode).toBeTypeOf("function");
    if (!imported?.createNode) return;

    const id = crypto.randomUUID();
    const node = await imported.createNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        id,
        name: "Alice",
        description: "Protagonist",
        iconKey: null,
        properties: { allegiance: "North" },
      },
      { graph, stories, access },
    );

    expect(node).toMatchObject({
      id,
      storyId: "story-1",
      name: "Alice",
      properties: { allegiance: "North" },
      version: 1,
    });
    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
  });

  it("lists and gets only Nodes from the requested Story after graph:read authorization", async () => {
    const listImported = await loadGraphModule(modulePaths.list);
    const getImported = await loadGraphModule(modulePaths.get);
    expect(listImported?.listNodes).toBeTypeOf("function");
    expect(getImported?.getNode).toBeTypeOf("function");
    if (!listImported?.listNodes || !getImported?.getNode) return;

    await graph.createNode(nodeFixture({ id: "node-1" }));
    await graph.createNode(nodeFixture({ id: "node-2", storyId: "story-2" }));

    const nodes = await listImported.listNodes(
      { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-1" },
      { graph, stories, access },
    );
    expect(nodes.map((node) => node.id)).toEqual(["node-1"]);

    const found = await getImported.getNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        nodeId: "node-1",
      },
      { graph, stories, access },
    );
    expect(found.id).toBe("node-1");
    expect(access.requireCapability).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "graph:read" }),
    );
  });

  it("returns NOT_FOUND before exposing a cross-workspace or cross-Story Node", async () => {
    const imported = await loadGraphModule(modulePaths.get);
    expect(imported?.getNode).toBeTypeOf("function");
    if (!imported?.getNode) return;

    await graph.createNode(nodeFixture({ id: "hidden-node", storyId: "story-2" }));

    await expect(
      imported.getNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-2",
          storyId: "story-1",
          nodeId: "hidden-node",
        },
        { graph, stories, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(access.requireCapability).not.toHaveBeenCalled();
  });

  it("updates with optimistic locking and returns 409 for a stale version", async () => {
    const imported = await loadGraphModule(modulePaths.update);
    expect(imported?.updateNode).toBeTypeOf("function");
    if (!imported?.updateNode) return;

    await graph.createNode(nodeFixture({ id: "node-1" }));

    const updated = await imported.updateNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        nodeId: "node-1",
        expectedVersion: 1,
        name: "Alice II",
      },
      { graph, stories, access },
    );
    expect(updated).toMatchObject({ name: "Alice II", version: 2 });

    await expect(
      imported.updateNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          nodeId: "node-1",
          expectedVersion: 1,
          description: "stale edit",
        },
        { graph, stories, access },
      ),
    ).rejects.toEqual(expect.objectContaining({ code: "CONFLICT", status: 409 }));
  });

  it("deletes an existing Node and returns NOT_FOUND for an unknown Node", async () => {
    const imported = await loadGraphModule(modulePaths.delete);
    expect(imported?.deleteNode).toBeTypeOf("function");
    if (!imported?.deleteNode) return;

    await graph.createNode(nodeFixture({ id: "node-1" }));

    await expect(
      imported.deleteNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          nodeId: "node-1",
        },
        { graph, stories, access },
      ),
    ).resolves.toBeUndefined();

    expect(await graph.findNodeById("node-1")).toBeNull();

    await expect(
      imported.deleteNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          nodeId: "missing",
        },
        { graph, stories, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("propagates workspace authorization failures", async () => {
    const imported = await loadGraphModule(modulePaths.create);
    expect(imported?.createNode).toBeTypeOf("function");
    if (!imported?.createNode) return;

    vi.mocked(access.requireCapability).mockRejectedValueOnce(
      new ApplicationError("FORBIDDEN", 403),
    );

    await expect(
      imported.createNode(
        {
          actorId: "user-2",
          workspaceId: "workspace-1",
          storyId: "story-1",
          id: crypto.randomUUID(),
          name: "Denied",
          description: "",
          iconKey: null,
          properties: {},
        },
        { graph, stories, access },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
