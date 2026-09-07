import { NextResponse } from "next/server";

import { deleteNode } from "@/backend/modules/graph/application/delete-node/delete-node";
import { updateNode } from "@/backend/modules/graph/application/update-node/update-node";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphIdSchema,
  updateNodeRequestSchema,
  workspaceQuerySchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../_shared/graph-dependencies";
import { toGraphNodeResponse } from "../../../../_shared/graph-http";
import { identityDependencies } from "../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../_shared/route-error";

type BoardNodeRouteContext = {
  params: Promise<{ boardId: string; nodeId: string }>;
};

export async function PATCH(request: Request, context: BoardNodeRouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, nodeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedNodeId = graphIdSchema.parse(nodeId);
    const body = updateNodeRequestSchema.parse(await request.json());
    const updated = await updateNode(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        nodeId: validatedNodeId,
        expectedVersion: body.expectedVersion,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(body.iconKey !== undefined ? { iconKey: body.iconKey } : {}),
        ...(body.properties !== undefined ? { properties: body.properties } : {}),
        ...(body.x !== undefined ? { x: body.x } : {}),
        ...(body.y !== undefined ? { y: body.y } : {}),
        ...(body.width !== undefined ? { width: body.width } : {}),
        ...(body.height !== undefined ? { height: body.height } : {}),
        ...(body.zIndex !== undefined ? { zIndex: body.zIndex } : {}),
        ...(body.presentation !== undefined
          ? { presentation: body.presentation }
          : {}),
      },
      graphDependencies,
    );
    return NextResponse.json(toGraphNodeResponse(updated));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: BoardNodeRouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, nodeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedNodeId = graphIdSchema.parse(nodeId);
    const query = workspaceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    await deleteNode(
      {
        actorId: actor.id,
        workspaceId: query.workspaceId,
        boardId: validatedBoardId,
        nodeId: validatedNodeId,
      },
      graphDependencies,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
