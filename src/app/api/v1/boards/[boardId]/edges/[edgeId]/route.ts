import { NextResponse } from "next/server";

import { removeEdgeFromBoard } from "@/backend/modules/graph/application/remove-edge-from-board/remove-edge-from-board";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import { graphIdSchema, workspaceQuerySchema } from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../_shared/graph-dependencies";
import { identityDependencies } from "../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../_shared/route-error";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ boardId: string; edgeId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, edgeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedEdgeId = graphIdSchema.parse(edgeId);
    const query = workspaceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    await removeEdgeFromBoard(
      {
        actorId: actor.id,
        workspaceId: query.workspaceId,
        boardId: validatedBoardId,
        edgeId: validatedEdgeId,
      },
      graphDependencies,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
