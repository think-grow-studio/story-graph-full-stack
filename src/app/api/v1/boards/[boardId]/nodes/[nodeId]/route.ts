import { NextResponse } from "next/server";

import { removeNodeFromBoard } from "@/backend/modules/graph/application/remove-node-from-board/remove-node-from-board";
import { restoreNodeToBoard } from "@/backend/modules/graph/application/restore-node-to-board/restore-node-to-board";
import { updateBoardNode } from "@/backend/modules/graph/application/update-board-node/update-board-node";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  boardNodeResponseSchema,
  graphIdSchema,
  restoreBoardNodeRequestSchema,
  restoreBoardNodeResponseSchema,
  updateBoardNodeRequestSchema,
  workspaceQuerySchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../_shared/graph-dependencies";
import {
  toBoardEdgeResponse,
  toBoardNodeResponse,
  toGraphEdgeResponse,
  toGraphNodeResponse,
} from "../../../../_shared/graph-http";
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
    const body = updateBoardNodeRequestSchema.parse(await request.json());
    const updated = await updateBoardNode(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        nodeId: validatedNodeId,
        ...(body.x !== undefined ? { x: body.x } : {}),
        ...(body.y !== undefined ? { y: body.y } : {}),
        ...(body.width !== undefined ? { width: body.width } : {}),
        ...(body.height !== undefined ? { height: body.height } : {}),
        ...(body.zIndex !== undefined ? { zIndex: body.zIndex } : {}),
        ...(body.style !== undefined ? { style: body.style } : {}),
      },
      graphDependencies,
    );
    return NextResponse.json(boardNodeResponseSchema.parse(toBoardNodeResponse(updated)));
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
    await removeNodeFromBoard(
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

export async function PUT(request: Request, context: BoardNodeRouteContext) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, nodeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedNodeId = graphIdSchema.parse(nodeId);
    const body = restoreBoardNodeRequestSchema.parse(await request.json());
    const restored = await restoreNodeToBoard(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        nodeId: validatedNodeId,
        placement: {
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
          zIndex: body.zIndex,
          style: body.style,
        },
        boardEdges: body.boardEdges,
      },
      graphDependencies,
    );
    return NextResponse.json(
      restoreBoardNodeResponseSchema.parse({
        node: toGraphNodeResponse(restored.node),
        boardNode: toBoardNodeResponse(restored.boardNode),
        edges: restored.edges.map(toGraphEdgeResponse),
        boardEdges: restored.boardEdges.map(toBoardEdgeResponse),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
