import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createStory } from "./create-story/create-story";
import { deleteStory } from "./delete-story/delete-story";
import { getStory } from "./get-story/get-story";
import { listStories } from "./list-stories/list-stories";
import { updateStory } from "./update-story/update-story";
import type { Story } from "../domain/story";
import type { StoryRepository } from "../domain/story.repository";

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

  async update(input: { id: string; name?: string; description?: string }) {
    const current = this.stories.get(input.id);
    if (!current) return null;
    const updated = {
      ...current,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      updatedAt: new Date(),
    };
    this.stories.set(input.id, updated);
    return updated;
  }

  async delete(id: string) {
    return this.stories.delete(id);
  }
}

function createAccess(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

function storyFixture(overrides: Partial<Story> = {}): Story {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: crypto.randomUUID(),
    workspaceId: "workspace-1",
    name: "Original",
    description: "Description",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Story use-cases", () => {
  let repository: FakeStoryRepository;
  let access: WorkspaceAccessService;

  beforeEach(() => {
    repository = new FakeStoryRepository();
    access = createAccess();
  });

  it("creates a Story after story:create authorization", async () => {
    const story = await createStory(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        name: "My Story",
        description: "A world",
      },
      { repository, access },
    );

    expect(story).toMatchObject({
      workspaceId: "workspace-1",
      name: "My Story",
      description: "A world",
    });
    expect(story.id).toBeTruthy();
    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "story:create",
    });
  });

  it("lists only Stories in the authorized workspace", async () => {
    await repository.create(storyFixture({ id: "story-1" }));
    await repository.create(storyFixture({ id: "story-2", workspaceId: "workspace-2" }));

    const stories = await listStories(
      { actorId: "user-1", workspaceId: "workspace-1" },
      { repository, access },
    );

    expect(stories.map((story) => story.id)).toEqual(["story-1"]);
    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "story:read",
    });
  });

  it("gets, updates, and deletes a Story through explicit capabilities", async () => {
    await repository.create(storyFixture({ id: "story-1" }));

    const found = await getStory(
      { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-1" },
      { repository, access },
    );
    expect(found.id).toBe("story-1");

    const updated = await updateStory(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        name: "Renamed",
      },
      { repository, access },
    );
    expect(updated.name).toBe("Renamed");

    await expect(
      deleteStory(
        { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-1" },
        { repository, access },
      ),
    ).resolves.toBeUndefined();
    await expect(repository.findById("story-1")).resolves.toBeNull();

    expect(access.requireCapability).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "story:read" }),
    );
    expect(access.requireCapability).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "story:update" }),
    );
    expect(access.requireCapability).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "story:delete" }),
    );
  });

  it("propagates FORBIDDEN from workspace authorization", async () => {
    vi.mocked(access.requireCapability).mockRejectedValueOnce(
      Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN", status: 403 }),
    );

    await expect(
      createStory(
        {
          actorId: "user-2",
          workspaceId: "workspace-1",
          name: "Denied",
          description: "",
        },
        { repository, access },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("returns NOT_FOUND for missing or cross-workspace Story IDs", async () => {
    await repository.create(storyFixture({ id: "story-other", workspaceId: "workspace-2" }));

    await expect(
      getStory(
        { actorId: "user-1", workspaceId: "workspace-1", storyId: "missing" },
        { repository, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    await expect(
      getStory(
        { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-other" },
        { repository, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
