import { NextResponse } from "next/server";

import { restoreNode } from "@/backend/modules/graph/application/restore-node/restore-node";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphIdSchema,
  restoreNodeRequestSchema,
  restoreNodeResponseSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../../_shared/graph-dependencies";
import {
  toGraphEdgeResponse,
  toGraphNodeResponse,
} from "../../../../../_shared/graph-http";
import { identityDependencies } from "../../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../../_shared/route-error";

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string; nodeId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, nodeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedNodeId = graphIdSchema.parse(nodeId);
    const body = restoreNodeRequestSchema.parse(await request.json());
    const restored = await restoreNode(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        nodeId: validatedNodeId,
        node: body.node,
        edges: body.edges,
      },
      graphDependencies,
    );
    return NextResponse.json(
      restoreNodeResponseSchema.parse({
        node: toGraphNodeResponse(restored.node),
        edges: restored.edges.map(toGraphEdgeResponse),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
