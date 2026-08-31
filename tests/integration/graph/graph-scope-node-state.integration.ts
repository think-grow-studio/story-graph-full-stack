import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardEdge,
  boardNode,
  edgeState,
  graphEdge,
  graphNode,
  nodeState,
  organization,
  scope,
  user,
} from "@/backend/infrastructure/database/schema";
import { DrizzleGraphRepository } from "@/backend/modules/graph/infrastructure/drizzle-graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import { DrizzleStoryRepository } from "@/backend/modules/story/infrastructure/drizzle-story.repository";
import { ensurePersonalWorkspace } from "@/backend/modules/workspace/application/ensure-personal-workspace/ensure-personal-workspace";
import { BetterAuthWorkspaceProvisioner } from "@/backend/modules/workspace/infrastructure/better-auth-workspace-provisioner";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";
import { createTestIdentity } from "../../helpers/test-auth";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

async function createWorkspace(name: string) {
  const identity = await createTestIdentity(name);
  createdUserIds.push(identity.user.id);

  const workspace = await ensurePersonalWorkspace(
    { userId: identity.user.id, userName: identity.user.name },
    {
      access: new DrizzleWorkspaceAccessService(),
      provisioner: new BetterAuthWorkspaceProvisioner(),
    },
  );
  createdOrganizationIds.push(workspace.id);
  return workspace;
}

async function createStory(workspaceId: string, name: string) {
  const now = new Date();
  const story: Story = {
    id: crypto.randomUUID(),
    workspaceId,
    name,
    description: "",
    createdAt: now,
    updatedAt: now,
  };
  await new DrizzleStoryRepository().create(story);
  return story;
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("Scope state database invariants", () => {
  it("stores NodeState only when Scope and Node belong to the same Story", async () => {
    const workspace = await createWorkspace("Scope State Owner");
    const firstStory = await createStory(workspace.id, "First Story");
    const secondStory = await createStory(workspace.id, "Second Story");
    const scopeId = crypto.randomUUID();
    const firstNodeId = crypto.randomUUID();
    const secondNodeId = crypto.randomUUID();

    await db.insert(scope).values({
      id: scopeId,
      storyId: firstStory.id,
      name: "Chapter 10",
    });
    await db.insert(graphNode).values([
      { id: firstNodeId, storyId: firstStory.id, name: "Alice" },
      { id: secondNodeId, storyId: secondStory.id, name: "Bob" },
    ]);

    await expect(
      db.insert(nodeState).values({
        scopeId,
        nodeId: firstNodeId,
        storyId: firstStory.id,
        name: "Queen Alice",
        description: null,
        properties: null,
      }),
    ).resolves.toBeDefined();

    await expect(
      db.insert(nodeState).values({
        scopeId,
        nodeId: secondNodeId,
        storyId: firstStory.id,
        name: "Invalid Bob",
        description: null,
        properties: null,
      }),
    ).rejects.toBeTruthy();
  });

  it("stores EdgeState only when Scope and Edge belong to the same Story", async () => {
    const workspace = await createWorkspace("Edge State Owner");
    const firstStory = await createStory(workspace.id, "First Edge Story");
    const secondStory = await createStory(workspace.id, "Second Edge Story");
    const scopeId = crypto.randomUUID();
    const firstSourceId = crypto.randomUUID();
    const firstTargetId = crypto.randomUUID();
    const secondSourceId = crypto.randomUUID();
    const secondTargetId = crypto.randomUUID();
    const firstEdgeId = crypto.randomUUID();
    const secondEdgeId = crypto.randomUUID();

    await db.insert(scope).values({
      id: scopeId,
      storyId: firstStory.id,
      name: "Chapter 10",
    });
    await db.insert(graphNode).values([
      { id: firstSourceId, storyId: firstStory.id, name: "Alice" },
      { id: firstTargetId, storyId: firstStory.id, name: "Crown" },
      { id: secondSourceId, storyId: secondStory.id, name: "Bob" },
      { id: secondTargetId, storyId: secondStory.id, name: "Council" },
    ]);
    await db.insert(graphEdge).values([
      {
        id: firstEdgeId,
        storyId: firstStory.id,
        sourceNodeId: firstSourceId,
        targetNodeId: firstTargetId,
        name: "serves",
      },
      {
        id: secondEdgeId,
        storyId: secondStory.id,
        sourceNodeId: secondSourceId,
        targetNodeId: secondTargetId,
        name: "advises",
      },
    ]);

    await expect(
      db.insert(edgeState).values({
        scopeId,
        edgeId: firstEdgeId,
        storyId: firstStory.id,
        name: "rules",
        description: null,
        properties: null,
      }),
    ).resolves.toBeDefined();

    await expect(
      db.insert(edgeState).values({
        scopeId,
        edgeId: secondEdgeId,
        storyId: firstStory.id,
        name: "Invalid Edge State",
        description: null,
        properties: null,
      }),
    ).rejects.toBeTruthy();
  });

  it("uses create-if-absent and numeric compare-and-set for EdgeState", async () => {
    const workspace = await createWorkspace("Edge CAS Owner");
    const story = await createStory(workspace.id, "Edge CAS Story");
    const scopeId = crypto.randomUUID();
    const sourceNodeId = crypto.randomUUID();
    const targetNodeId = crypto.randomUUID();
    const edgeId = crypto.randomUUID();
    const repository = new DrizzleGraphRepository();

    await db.insert(scope).values({ id: scopeId, storyId: story.id, name: "Chapter 10" });
    await db.insert(graphNode).values([
      { id: sourceNodeId, storyId: story.id, name: "Alice" },
      { id: targetNodeId, storyId: story.id, name: "Crown" },
    ]);
    await db.insert(graphEdge).values({
      id: edgeId,
      storyId: story.id,
      sourceNodeId,
      targetNodeId,
      name: "serves",
    });

    const created = await repository.putEdgeState({
      scopeId,
      edgeId,
      expectedVersion: null,
      name: "rules",
      description: null,
      properties: null,
    });
    expect(created).toMatchObject({ scopeId, edgeId, name: "rules", version: 1 });

    await expect(
      repository.putEdgeState({
        scopeId,
        edgeId,
        expectedVersion: null,
        name: "commands",
        description: null,
        properties: null,
      }),
    ).resolves.toBe("conflict");

    const updated = await repository.putEdgeState({
      scopeId,
      edgeId,
      expectedVersion: 1,
      name: "commands",
      description: null,
      properties: { trust: 9 },
    });
    expect(updated).toMatchObject({ name: "commands", properties: { trust: 9 }, version: 2 });

    await expect(
      repository.putEdgeState({
        scopeId,
        edgeId,
        expectedVersion: 1,
        name: "stale",
        description: null,
        properties: null,
      }),
    ).resolves.toBe("conflict");
  });

  it("rejects a Board scoped to a Scope from another Story", async () => {
    const workspace = await createWorkspace("Board Scope Owner");
    const boardStory = await createStory(workspace.id, "Board Story");
    const scopeStory = await createStory(workspace.id, "Scope Story");
    const scopeId = crypto.randomUUID();

    await db.insert(scope).values({
      id: scopeId,
      storyId: scopeStory.id,
      name: "Other Chapter",
    });

    await expect(
      db.insert(board).values({
        id: crypto.randomUUID(),
        storyId: boardStory.id,
        scopeId,
        name: "Invalid Scoped Board",
      }),
    ).rejects.toBeTruthy();
  });

  it("returns only represented NodeState and EdgeState rows for a scoped Board snapshot", async () => {
    const workspace = await createWorkspace("Scoped Snapshot Owner");
    const story = await createStory(workspace.id, "Snapshot Story");
    const scopeId = crypto.randomUUID();
    const boardId = crypto.randomUUID();
    const representedNodeId = crypto.randomUUID();
    const secondRepresentedNodeId = crypto.randomUUID();
    const hiddenNodeId = crypto.randomUUID();
    const representedEdgeId = crypto.randomUUID();
    const hiddenEdgeId = crypto.randomUUID();

    await db.insert(scope).values({ id: scopeId, storyId: story.id, name: "Chapter 10" });
    await db.insert(board).values({
      id: boardId,
      storyId: story.id,
      scopeId,
      name: "Scoped Board",
    });
    await db.insert(graphNode).values([
      { id: representedNodeId, storyId: story.id, name: "Alice" },
      { id: secondRepresentedNodeId, storyId: story.id, name: "Crown" },
      { id: hiddenNodeId, storyId: story.id, name: "Bob" },
    ]);
    await db.insert(boardNode).values([
      {
        boardId,
        nodeId: representedNodeId,
        storyId: story.id,
        x: 10,
        y: 20,
      },
      {
        boardId,
        nodeId: secondRepresentedNodeId,
        storyId: story.id,
        x: 30,
        y: 40,
      },
    ]);
    await db.insert(nodeState).values([
      {
        scopeId,
        nodeId: representedNodeId,
        storyId: story.id,
        name: "Queen Alice",
      },
      {
        scopeId,
        nodeId: hiddenNodeId,
        storyId: story.id,
        name: "Hidden Bob",
      },
    ]);
    await db.insert(graphEdge).values([
      {
        id: representedEdgeId,
        storyId: story.id,
        sourceNodeId: representedNodeId,
        targetNodeId: secondRepresentedNodeId,
        name: "serves",
      },
      {
        id: hiddenEdgeId,
        storyId: story.id,
        sourceNodeId: hiddenNodeId,
        targetNodeId: secondRepresentedNodeId,
        name: "advises",
      },
    ]);
    await db.insert(boardEdge).values({
      boardId,
      edgeId: representedEdgeId,
      storyId: story.id,
    });
    await db.insert(edgeState).values([
      {
        scopeId,
        edgeId: representedEdgeId,
        storyId: story.id,
        name: "rules",
      },
      {
        scopeId,
        edgeId: hiddenEdgeId,
        storyId: story.id,
        name: "secretly advises",
      },
    ]);

    const snapshot = await new DrizzleGraphRepository().getBoardSnapshot(boardId);

    expect(snapshot?.scope).toMatchObject({ id: scopeId, name: "Chapter 10" });
    expect(snapshot?.nodes.map((node) => node.id).sort()).toEqual(
      [representedNodeId, secondRepresentedNodeId].sort(),
    );
    expect(snapshot?.nodeStates).toEqual([
      expect.objectContaining({
        scopeId,
        nodeId: representedNodeId,
        name: "Queen Alice",
      }),
    ]);
    expect(snapshot?.edges.map((edge) => edge.id)).toEqual([representedEdgeId]);
    expect(snapshot?.edgeStates).toEqual([
      expect.objectContaining({
        scopeId,
        edgeId: representedEdgeId,
        name: "rules",
      }),
    ]);
  });

  it("returns canonical-only state metadata for an unscoped Board snapshot", async () => {
    const workspace = await createWorkspace("Unscoped Snapshot Owner");
    const story = await createStory(workspace.id, "Canonical Story");
    const boardId = crypto.randomUUID();

    await db.insert(board).values({
      id: boardId,
      storyId: story.id,
      scopeId: null,
      name: "Canonical Board",
    });

    const snapshot = await new DrizzleGraphRepository().getBoardSnapshot(boardId);

    expect(snapshot?.scope).toBeNull();
    expect(snapshot?.nodeStates).toEqual([]);
    expect(snapshot?.edgeStates).toEqual([]);
  });
});
