import { NextResponse } from "next/server";

import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import { createStory } from "@/backend/modules/story/application/create-story/create-story";
import { listStories } from "@/backend/modules/story/application/list-stories/list-stories";
import type { Story } from "@/backend/modules/story/domain/story";
import { DrizzleStoryRepository } from "@/backend/modules/story/infrastructure/drizzle-story.repository";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";
import {
  createStoryRequestSchema,
  listStoriesQuerySchema,
  listStoriesResponseSchema,
  storyResponseSchema,
} from "@/contracts/story/story.contract";
import { routeErrorResponse } from "../_shared/route-error";

const dependencies = {
  repository: new DrizzleStoryRepository(),
  access: new DrizzleWorkspaceAccessService(),
};

function toResponse(story: Story) {
  return storyResponseSchema.parse({
    ...story,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentActor(request.headers);
    const query = listStoriesQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const stories = await listStories(
      { actorId: actor.id, workspaceId: query.workspaceId },
      dependencies,
    );

    return NextResponse.json(
      listStoriesResponseSchema.parse({ stories: stories.map(toResponse) }),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentActor(request.headers);
    const body = createStoryRequestSchema.parse(await request.json());
    const story = await createStory(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
      },
      dependencies,
    );

    return NextResponse.json(toResponse(story), { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
