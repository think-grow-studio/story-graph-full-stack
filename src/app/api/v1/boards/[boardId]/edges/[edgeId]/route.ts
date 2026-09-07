import { NextResponse } from "next/server";

import { deleteEdge } from "@/backend/modules/graph/application/delete-edge/delete-edge";
import { updateEdge } from "@/backend/modules/graph/application/update-edge/update-edge";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphIdSchema,
  updateEdgeRequestSchema,
  workspaceQuerySchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../_shared/graph-dependencies";
import { toGraphEdgeResponse } from "../../../../_shared/graph-http";
import { identityDependencies } from "../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../_shared/route-error";

type BoardEdgeRouteContext = {
  params: Promise<{ boardId: string; edgeId: string }>;
};

export async function PATCH(request: Request, context: BoardEdgeRouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, edgeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedEdgeId = graphIdSchema.parse(edgeId);
    const body = updateEdgeRequestSchema.parse(await request.json());
    const updated = await updateEdge(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        edgeId: validatedEdgeId,
        expectedVersion: body.expectedVersion,
        ...(body.direction !== undefined ? { direction: body.direction } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(body.iconKey !== undefined ? { iconKey: body.iconKey } : {}),
        ...(body.properties !== undefined ? { properties: body.properties } : {}),
        ...(body.presentation !== undefined
          ? { presentation: body.presentation }
          : {}),
        ...(body.routing !== undefined ? { routing: body.routing } : {}),
      },
      graphDependencies,
    );
    return NextResponse.json(toGraphEdgeResponse(updated));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: BoardEdgeRouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, edgeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedEdgeId = graphIdSchema.parse(edgeId);
    const query = workspaceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    await deleteEdge(
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
