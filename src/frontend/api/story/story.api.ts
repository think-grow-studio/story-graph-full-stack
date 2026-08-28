import {
  createStoryRequestSchema,
  listStoriesResponseSchema,
  storyResponseSchema,
  type CreateStoryRequest,
  type StoryResponse,
} from "@/contracts/story/story.contract";

import { apiClient } from "../client/api-client";

export async function listStories(workspaceId: string): Promise<StoryResponse[]> {
  const response = await apiClient.get("/api/v1/stories", {
    params: { workspaceId },
  });
  return listStoriesResponseSchema.parse(response.data).stories;
}

export async function createStory(input: CreateStoryRequest): Promise<StoryResponse> {
  const payload = createStoryRequestSchema.parse(input);
  const response = await apiClient.post("/api/v1/stories", payload);
  return storyResponseSchema.parse(response.data);
}
