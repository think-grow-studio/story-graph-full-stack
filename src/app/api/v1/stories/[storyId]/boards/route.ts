import { NextResponse } from "next/server";

import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import { createBoard } from "@/backend/modules/graph/application/create-board/create-board";
import { createBoardRequestSchema, graphIdSchema } from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../_shared/graph-dependencies";
import { toBoardResponse } from "../../../_shared/graph-http";
import { identityDependencies } from "../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../_shared/route-error";

export async function POST(
  request: Request,
  context: { params: Promise<{ storyId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { storyId } = await context.params;
    const validatedStoryId = graphIdSchema.parse(storyId);
    const body = createBoardRequestSchema.parse(await request.json());
    const created = await createBoard(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        storyId: validatedStoryId,
        name: body.name,
        description: body.description,
      },
      graphDependencies,
    );
    return NextResponse.json(toBoardResponse(created), { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
