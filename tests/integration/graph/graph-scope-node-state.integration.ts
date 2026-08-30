import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  graphNode,
  nodeState,
  organization,
  scope,
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

describe("Scope and NodeState database invariants", () => {
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
});
