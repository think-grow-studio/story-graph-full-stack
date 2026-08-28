import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardEdge,
  boardNode,
  graphEdge,
  graphNode,
  organization,
  user,
} from "@/backend/infrastructure/database/schema";
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

describe("graph database invariants", () => {
  it("allows multiple directed edges with the same source and target", async () => {
    const workspace = await createWorkspace("Multi Edge Owner");
    const story = await createStory(workspace.id, "Multi Edge Story");
    const sourceId = crypto.randomUUID();
    const targetId = crypto.randomUUID();

    await db.insert(graphNode).values([
      { id: sourceId, storyId: story.id, name: "Source" },
      { id: targetId, storyId: story.id, name: "Target" },
    ]);

    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    await db.insert(graphEdge).values([
      {
        id: firstId,
        storyId: story.id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        name: "trusts",
      },
      {
        id: secondId,
        storyId: story.id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        name: "protects",
      },
    ]);

    const rows = await db
      .select({ id: graphEdge.id })
      .from(graphEdge)
      .where(eq(graphEdge.storyId, story.id));

    expect(rows.map((row) => row.id).sort()).toEqual([firstId, secondId].sort());
  });

  it("rejects an edge whose endpoint belongs to another Story", async () => {
    const workspace = await createWorkspace("Cross Story Edge Owner");
    const firstStory = await createStory(workspace.id, "First Story");
    const secondStory = await createStory(workspace.id, "Second Story");
    const firstNodeId = crypto.randomUUID();
    const secondNodeId = crypto.randomUUID();

    await db.insert(graphNode).values([
      { id: firstNodeId, storyId: firstStory.id, name: "First Node" },
      { id: secondNodeId, storyId: secondStory.id, name: "Second Node" },
    ]);

    await expect(
      db.insert(graphEdge).values({
        id: crypto.randomUUID(),
        storyId: firstStory.id,
        sourceNodeId: firstNodeId,
        targetNodeId: secondNodeId,
        name: "invalid",
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects Board presentation rows that reference another Story", async () => {
    const workspace = await createWorkspace("Cross Story Board Owner");
    const firstStory = await createStory(workspace.id, "Board Story");
    const secondStory = await createStory(workspace.id, "Other Story");
    const firstBoardId = crypto.randomUUID();
    const firstNodeId = crypto.randomUUID();
    const secondNodeId = crypto.randomUUID();

    await db.insert(board).values({
      id: firstBoardId,
      storyId: firstStory.id,
      name: "Main Board",
    });
    await db.insert(graphNode).values([
      { id: firstNodeId, storyId: firstStory.id, name: "First Node" },
      { id: secondNodeId, storyId: secondStory.id, name: "Second Node" },
    ]);

    await expect(
      db.insert(boardNode).values({
        boardId: firstBoardId,
        nodeId: secondNodeId,
        storyId: firstStory.id,
        x: 0,
        y: 0,
      }),
    ).rejects.toBeTruthy();

    const otherEdgeId = crypto.randomUUID();
    await db.insert(graphEdge).values({
      id: otherEdgeId,
      storyId: secondStory.id,
      sourceNodeId: secondNodeId,
      targetNodeId: secondNodeId,
      name: "self",
    });

    await expect(
      db.insert(boardEdge).values({
        boardId: firstBoardId,
        edgeId: otherEdgeId,
        storyId: firstStory.id,
      }),
    ).rejects.toBeTruthy();

    const validBoardNodeId = crypto.randomUUID();
    await db.insert(graphNode).values({
      id: validBoardNodeId,
      storyId: firstStory.id,
      name: "Valid Board Node",
    });
    await expect(
      db.insert(boardNode).values({
        boardId: firstBoardId,
        nodeId: validBoardNodeId,
        storyId: firstStory.id,
        x: 10,
        y: 20,
      }),
    ).resolves.toBeDefined();
  });
});
