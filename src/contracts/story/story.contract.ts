import { z } from "zod";

export const storyResponseSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string(),
  description: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createStoryRequestSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).default(""),
});

export const listStoriesQuerySchema = z.object({
  workspaceId: z.string().min(1),
});

export const storyWorkspaceQuerySchema = z.object({
  workspaceId: z.string().min(1),
});

export const updateStoryRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(10_000).optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: "At least one Story field must be updated",
  });

export const listStoriesResponseSchema = z.object({
  stories: z.array(storyResponseSchema),
});

export type StoryResponse = z.infer<typeof storyResponseSchema>;
export type CreateStoryRequest = z.infer<typeof createStoryRequestSchema>;
export type UpdateStoryRequest = z.infer<typeof updateStoryRequestSchema>;
