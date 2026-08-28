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

async function loadModule(path: string) {
  return vi.importActual<Record<string, (...args: any[]) => Promise<any>>>(path).catch(() => null);
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
  nodes = new Map<string, any>();

  async createNode(node: any) {
    this.nodes.set(node.id, node);
    return node;
  }

  async findNodeById(id: string) {
    return this.nodes.get(id) ?? null;
  }

  async listNodesByStory(storyId: string) {
    return [...this.nodes.values()].filter((node) => node.storyId === storyId);
  }

  async updateNode(input: any) {
    const current = this.nodes.get(input.id);
    if (!current) return { kind: "not-found" };
    if (current.version !== input.expectedVersion) return { kind: "conflict" };

    const updated = {
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

function nodeFixture(overrides: Record<string, unknown> = {}) {
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
    const module = await loadModule(modulePaths.create);
    expect(module).not.toBeNull();
    if (!module) return;

    const id = crypto.randomUUID();
    const node = await module.createNode(
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
    const listModule = await loadModule(modulePaths.list);
    const getModule = await loadModule(modulePaths.get);
    expect(listModule).not.toBeNull();
    expect(getModule).not.toBeNull();
    if (!listModule || !getModule) return;

    await graph.createNode(nodeFixture({ id: "node-1" }));
    await graph.createNode(nodeFixture({ id: "node-2", storyId: "story-2" }));

    const nodes = await listModule.listNodes(
      { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-1" },
      { graph, stories, access },
    );
    expect(nodes.map((node: any) => node.id)).toEqual(["node-1"]);

    const found = await getModule.getNode(
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
    const getModule = await loadModule(modulePaths.get);
    expect(getModule).not.toBeNull();
    if (!getModule) return;

    await graph.createNode(nodeFixture({ id: "hidden-node", storyId: "story-2" }));

    await expect(
      getModule.getNode(
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
    const module = await loadModule(modulePaths.update);
    expect(module).not.toBeNull();
    if (!module) return;

    await graph.createNode(nodeFixture({ id: "node-1" }));

    const updated = await module.updateNode(
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
      module.updateNode(
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
    const module = await loadModule(modulePaths.delete);
    expect(module).not.toBeNull();
    if (!module) return;

    await graph.createNode(nodeFixture({ id: "node-1" }));

    await expect(
      module.deleteNode(
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
      module.deleteNode(
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
    const module = await loadModule(modulePaths.create);
    expect(module).not.toBeNull();
    if (!module) return;

    vi.mocked(access.requireCapability).mockRejectedValueOnce(
      new ApplicationError("FORBIDDEN", 403),
    );

    await expect(
      module.createNode(
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
