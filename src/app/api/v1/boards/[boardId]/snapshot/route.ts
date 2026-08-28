import { NextResponse } from "next/server";

import { getBoardSnapshot } from "@/backend/modules/graph/application/get-board-snapshot/get-board-snapshot";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import { graphIdSchema, workspaceQuerySchema } from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../_shared/graph-dependencies";
import { toBoardSnapshotResponse } from "../../../_shared/graph-http";
import { identityDependencies } from "../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../_shared/route-error";

export async function GET(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const query = workspaceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const result = await getBoardSnapshot(
      {
        actorId: actor.id,
        workspaceId: query.workspaceId,
        boardId: validatedBoardId,
      },
      graphDependencies,
    );
    return NextResponse.json(toBoardSnapshotResponse(result));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
