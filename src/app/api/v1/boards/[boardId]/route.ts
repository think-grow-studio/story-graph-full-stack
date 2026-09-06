import { NextResponse } from "next/server";

import { updateBoard } from "@/backend/modules/graph/application/update-board/update-board";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  boardResponseSchema,
  graphIdSchema,
  updateBoardRequestSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../_shared/graph-dependencies";
import { toBoardResponse } from "../../_shared/graph-http";
import { identityDependencies } from "../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../_shared/route-error";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const body = updateBoardRequestSchema.parse(await request.json());
    const updated = await updateBoard(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
      },
      graphDependencies,
    );
    return NextResponse.json(boardResponseSchema.parse(toBoardResponse(updated)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
