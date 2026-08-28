import { NextResponse } from "next/server";

import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import { deleteStory } from "@/backend/modules/story/application/delete-story/delete-story";
import { getStory } from "@/backend/modules/story/application/get-story/get-story";
import { updateStory } from "@/backend/modules/story/application/update-story/update-story";
import type { Story } from "@/backend/modules/story/domain/story";
import { DrizzleStoryRepository } from "@/backend/modules/story/infrastructure/drizzle-story.repository";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";
import {
  storyResponseSchema,
  storyWorkspaceQuerySchema,
  updateStoryRequestSchema,
} from "@/contracts/story/story.contract";
import { identityDependencies } from "../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../_shared/route-error";

const dependencies = {
  repository: new DrizzleStoryRepository(),
  access: new DrizzleWorkspaceAccessService(),
};

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

function toResponse(story: Story) {
  return storyResponseSchema.parse({
    ...story,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { storyId } = await context.params;
    const query = storyWorkspaceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const story = await getStory(
      { actorId: actor.id, workspaceId: query.workspaceId, storyId },
      dependencies,
    );

    return NextResponse.json(toResponse(story));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { storyId } = await context.params;
    const body = updateStoryRequestSchema.parse(await request.json());
    const story = await updateStory(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        storyId,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.description === undefined ? {} : { description: body.description }),
      },
      dependencies,
    );

    return NextResponse.json(toResponse(story));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { storyId } = await context.params;
    const query = storyWorkspaceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    await deleteStory(
      { actorId: actor.id, workspaceId: query.workspaceId, storyId },
      dependencies,
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
