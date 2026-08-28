import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";
import type { Story } from "@/backend/modules/story/domain/story";
import { DrizzleStoryRepository } from "@/backend/modules/story/infrastructure/drizzle-story.repository";
import { ensurePersonalWorkspace } from "@/backend/modules/workspace/application/ensure-personal-workspace/ensure-personal-workspace";
import { BetterAuthWorkspaceProvisioner } from "@/backend/modules/workspace/infrastructure/better-auth-workspace-provisioner";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";
import { createTestIdentity } from "../../helpers/test-auth";

const graphRepositoryModulePath = "@/backend/modules/graph/infrastructure/drizzle-graph.repository";
const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

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

interface GraphRepositoryUnderTest {
  createNode(node: TestGraphNode): Promise<TestGraphNode>;
  findNodeById(id: string): Promise<TestGraphNode | null>;
  listNodesByStory(storyId: string): Promise<TestGraphNode[]>;
  updateNode(input: UpdateNodeInput): Promise<UpdateNodeResult>;
  deleteNode(id: string): Promise<boolean>;
  createEdge(edge: TestGraphEdge): Promise<TestGraphEdge>;
  findEdgeById(id: string): Promise<TestGraphEdge | null>;
  listEdgesByStory(storyId: string): Promise<TestGraphEdge[]>;
  updateEdge(input: UpdateEdgeInput): Promise<UpdateEdgeResult>;
  deleteEdge(id: string): Promise<boolean>;
}

type GraphRepositoryModule = {
  DrizzleGraphRepository: new () => GraphRepositoryUnderTest;
};

async function createStory() {
  const identity = await createTestIdentity("Graph Owner");
  createdUserIds.push(identity.user.id);

  const workspace = await ensurePersonalWorkspace(
    { userId: identity.user.id, userName: identity.user.name },
    {
      access: new DrizzleWorkspaceAccessService(),
      provisioner: new BetterAuthWorkspaceProvisioner(),
    },
  );
  createdOrganizationIds.push(workspace.id);

  const now = new Date();
  const story: Story = {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    name: "Graph Story",
    description: "",
    createdAt: now,
    updatedAt: now,
  };
  await new DrizzleStoryRepository().create(story);
  return story;
}

function nodeFixture(storyId: string, overrides: Partial<TestGraphNode> = {}): TestGraphNode {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    storyId,
    name: "Alice",
    description: "Protagonist",
    iconKey: null,
    properties: { age: 27, tags: ["lead"] },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function edgeFixture(
  storyId: string,
  sourceNodeId: string,
  targetNodeId: string,
  overrides: Partial<TestGraphEdge> = {},
): TestGraphEdge {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    storyId,
    sourceNodeId,
    targetNodeId,
    name: "knows",
    description: "",
    iconKey: null,
    properties: { strength: 1 },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("DrizzleGraphRepository", () => {
  it("creates, lists, reads, version-updates, and deletes canonical Nodes", async () => {
    const imported = await vi
      .importActual<GraphRepositoryModule>(graphRepositoryModulePath)
      .catch(() => null);
    expect(imported?.DrizzleGraphRepository).toBeTypeOf("function");
    if (!imported?.DrizzleGraphRepository) return;

    const story = await createStory();
    const repository = new imported.DrizzleGraphRepository();
    const first = nodeFixture(story.id, { id: crypto.randomUUID() });
    const second = nodeFixture(story.id, { id: crypto.randomUUID(), name: "Bob" });

    await repository.createNode(first);
    await repository.createNode(second);

    await expect(repository.findNodeById(first.id)).resolves.toMatchObject({
      id: first.id,
      storyId: story.id,
      properties: { age: 27, tags: ["lead"] },
      version: 1,
    });
    await expect(repository.listNodesByStory(story.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id }),
        expect.objectContaining({ id: second.id }),
      ]),
    );

    const update = await repository.updateNode({
      id: first.id,
      expectedVersion: 1,
      name: "Alice II",
      properties: { age: 28 },
    });
    expect(update).toMatchObject({
      kind: "updated",
      node: { id: first.id, name: "Alice II", properties: { age: 28 }, version: 2 },
    });

    await expect(
      repository.updateNode({ id: first.id, expectedVersion: 1, description: "stale" }),
    ).resolves.toEqual({ kind: "conflict" });

    await expect(repository.deleteNode(first.id)).resolves.toBe(true);
    await expect(repository.deleteNode(first.id)).resolves.toBe(false);
    await expect(repository.findNodeById(first.id)).resolves.toBeNull();
  });

  it("persists directed multi-edges, self-edges, and edge optimistic locking", async () => {
    const imported = await vi
      .importActual<GraphRepositoryModule>(graphRepositoryModulePath)
      .catch(() => null);
    expect(imported?.DrizzleGraphRepository).toBeTypeOf("function");
    if (!imported?.DrizzleGraphRepository) return;

    const story = await createStory();
    const repository = new imported.DrizzleGraphRepository();
    const nodeA = nodeFixture(story.id, { name: "A" });
    const nodeB = nodeFixture(story.id, { name: "B" });
    await repository.createNode(nodeA);
    await repository.createNode(nodeB);

    const duplicateA = edgeFixture(story.id, nodeA.id, nodeB.id);
    const duplicateB = edgeFixture(story.id, nodeA.id, nodeB.id);
    const reverse = edgeFixture(story.id, nodeB.id, nodeA.id);
    const self = edgeFixture(story.id, nodeA.id, nodeA.id);

    await repository.createEdge(duplicateA);
    await repository.createEdge(duplicateB);
    await repository.createEdge(reverse);
    await repository.createEdge(self);

    await expect(repository.listEdgesByStory(story.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: duplicateA.id, sourceNodeId: nodeA.id, targetNodeId: nodeB.id }),
        expect.objectContaining({ id: duplicateB.id, sourceNodeId: nodeA.id, targetNodeId: nodeB.id }),
        expect.objectContaining({ id: reverse.id, sourceNodeId: nodeB.id, targetNodeId: nodeA.id }),
        expect.objectContaining({ id: self.id, sourceNodeId: nodeA.id, targetNodeId: nodeA.id }),
      ]),
    );

    await expect(repository.findEdgeById(duplicateA.id)).resolves.toMatchObject({
      id: duplicateA.id,
      properties: { strength: 1 },
      version: 1,
    });

    const update = await repository.updateEdge({
      id: duplicateA.id,
      expectedVersion: 1,
      name: "trusts",
      properties: { strength: 2 },
    });
    expect(update).toMatchObject({
      kind: "updated",
      edge: { id: duplicateA.id, name: "trusts", properties: { strength: 2 }, version: 2 },
    });

    await expect(
      repository.updateEdge({ id: duplicateA.id, expectedVersion: 1, description: "stale" }),
    ).resolves.toEqual({ kind: "conflict" });

    await expect(repository.deleteEdge(duplicateA.id)).resolves.toBe(true);
    await expect(repository.deleteEdge(duplicateA.id)).resolves.toBe(false);
  });
});
