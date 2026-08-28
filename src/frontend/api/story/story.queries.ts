import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StoryResponse } from "@/contracts/story/story.contract";

import { createStory, listStories } from "./story.api";

export const storyQueryKeys = {
  list: (workspaceId: string) => ["stories", workspaceId] as const,
};

export function useStoriesQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceId ? storyQueryKeys.list(workspaceId) : ["stories", "pending"],
    queryFn: () => listStories(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateStoryMutation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description: string }) => {
      if (!workspaceId) {
        throw new Error("Workspace is not ready");
      }
      return createStory({ workspaceId, ...input });
    },
    onSuccess: (created) => {
      if (!workspaceId) return;
      queryClient.setQueryData<StoryResponse[]>(
        storyQueryKeys.list(workspaceId),
        (current = []) => [...current, created],
      );
    },
  });
}
