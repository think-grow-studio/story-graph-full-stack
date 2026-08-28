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

function nodeFixture(storyId: string, overrides: Record<string, unknown> = {}) {
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

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("DrizzleGraphRepository nodes", () => {
  it("creates, lists, reads, version-updates, and deletes canonical Nodes", async () => {
    const module = await vi
      .importActual<Record<string, new () => any>>(graphRepositoryModulePath)
      .catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const story = await createStory();
    const repository = new module.DrizzleGraphRepository();
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
});
