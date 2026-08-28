import { afterEach, describe, expect, it, vi } from "vitest";

import { getBootstrap } from "@/frontend/api/auth/bootstrap.api";
import { createStory, listStories } from "@/frontend/api/story/story.api";

import { apiClient } from "./api-client";

const storyResponse = {
  id: "story-1",
  workspaceId: "workspace-1",
  name: "Story",
  description: "",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("versioned API paths", () => {
  it("does not duplicate the /api/v1 base path for bootstrap", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        actor: { id: "user-1", email: "user@example.com", name: "User" },
        workspace: { id: "workspace-1", name: "User's Workspace", slug: "personal-user-1" },
      },
    });

    await getBootstrap();

    expect(get).toHaveBeenCalledWith("/bootstrap");
  });

  it("does not duplicate the /api/v1 base path for Story calls", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: { stories: [] } });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: storyResponse });

    await listStories("workspace-1");
    await createStory({ workspaceId: "workspace-1", name: "Story", description: "" });

    expect(get).toHaveBeenCalledWith("/stories", {
      params: { workspaceId: "workspace-1" },
    });
    expect(post).toHaveBeenCalledWith("/stories", {
      workspaceId: "workspace-1",
      name: "Story",
      description: "",
    });
  });
});
