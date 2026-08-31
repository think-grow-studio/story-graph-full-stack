import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardEdge,
  boardNode,
  edgeState,
  graphEdge,
  graphNode,
  nodeState,
  scope,
} from "@/backend/infrastructure/database/schema";
import type {
  Board,
  BoardEdge,
  BoardNode,
  BoardSnapshot,
  EdgeState,
  GraphEdge,
  GraphNode,
  NodeState,
  Scope,
} from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";

function toBoardNode(row: typeof boardNode.$inferSelect): BoardNode {
  return {
    boardId: row.boardId,
    nodeId: row.nodeId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    style: row.style,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toBoardEdge(row: typeof boardEdge.$inferSelect): BoardEdge {
  return {
    boardId: row.boardId,
    edgeId: row.edgeId,
    style: row.style,
    labelPresentation: row.labelPresentation,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toNodeState(row: typeof nodeState.$inferSelect): NodeState {
  return {
    scopeId: row.scopeId,
    nodeId: row.nodeId,
    name: row.name,
    description: row.description,
    properties: row.properties,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEdgeState(row: typeof edgeState.$inferSelect): EdgeState {
  return {
    scopeId: row.scopeId,
    edgeId: row.edgeId,
    name: row.name,
    description: row.description,
    properties: row.properties,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleGraphRepository implements GraphRepository {
  async createScope(input: {
    storyId: string;
    name: string;
    description: string;
  }): Promise<Scope> {
    const [created] = await db
      .insert(scope)
      .values({ id: crypto.randomUUID(), ...input })
      .returning();
    return created;
  }

  async listScopes(storyId: string): Promise<Scope[]> {
    return db
      .select()
      .from(scope)
      .where(eq(scope.storyId, storyId))
      .orderBy(asc(scope.createdAt), asc(scope.id));
  }

  async findScope(id: string): Promise<Scope | null> {
    const [found] = await db.select().from(scope).where(eq(scope.id, id)).limit(1);
    return found ?? null;
  }

  async createBoard(input: {
    storyId: string;
    scopeId?: string | null;
    name: string;
    description: string;
  }): Promise<Board> {
    const [created] = await db
      .insert(board)
      .values({
        id: crypto.randomUUID(),
        storyId: input.storyId,
        scopeId: input.scopeId ?? null,
        name: input.name,
        description: input.description,
      })
      .returning();
    return created;
  }

  async listBoards(storyId: string): Promise<Board[]> {
    return db
      .select()
      .from(board)
      .where(eq(board.storyId, storyId))
      .orderBy(asc(board.createdAt), asc(board.id));
  }

  async findBoard(id: string): Promise<Board | null> {
    const [found] = await db.select().from(board).where(eq(board.id, id)).limit(1);
    return found ?? null;
  }

  async listNodes(storyId: string): Promise<GraphNode[]> {
    return db
      .select()
      .from(graphNode)
      .where(eq(graphNode.storyId, storyId))
      .orderBy(asc(graphNode.createdAt), asc(graphNode.id));
  }

  async findNode(id: string): Promise<GraphNode | null> {
    const [found] = await db
      .select()
      .from(graphNode)
      .where(eq(graphNode.id, id))
      .limit(1);
    return found ?? null;
  }

  async findEdge(id: string): Promise<GraphEdge | null> {
    const [found] = await db
      .select()
      .from(graphEdge)
      .where(eq(graphEdge.id, id))
      .limit(1);
    return found ?? null;
  }

  async getBoardSnapshot(boardId: string): Promise<BoardSnapshot | null> {
    return db.transaction(
      async (tx) => {
        const [foundBoard] = await tx
          .select()
          .from(board)
          .where(eq(board.id, boardId))
          .limit(1);
        if (!foundBoard) return null;

        const foundScope = foundBoard.scopeId
          ? (
              await tx
                .select()
                .from(scope)
                .where(
                  and(
                    eq(scope.id, foundBoard.scopeId),
                    eq(scope.storyId, foundBoard.storyId),
                  ),
                )
                .limit(1)
            )[0] ?? null
          : null;
        if (foundBoard.scopeId && !foundScope) return null;

        const boardNodeRows = await tx
          .select()
          .from(boardNode)
          .where(eq(boardNode.boardId, boardId));
        const nodeIds = boardNodeRows.map((row) => row.nodeId);
        const nodes =
          nodeIds.length === 0
            ? []
            : await tx.select().from(graphNode).where(inArray(graphNode.id, nodeIds));
        const nodeStates =
          foundScope && nodeIds.length > 0
            ? await tx
                .select()
                .from(nodeState)
                .where(
                  and(
                    eq(nodeState.scopeId, foundScope.id),
                    inArray(nodeState.nodeId, nodeIds),
                  ),
                )
            : [];

        const boardEdgeRows = await tx
          .select()
          .from(boardEdge)
          .where(eq(boardEdge.boardId, boardId));
        const edgeIds = boardEdgeRows.map((row) => row.edgeId);
        const edges =
          edgeIds.length === 0
            ? []
            : await tx.select().from(graphEdge).where(inArray(graphEdge.id, edgeIds));
        const edgeStates =
          foundScope && edgeIds.length > 0
            ? await tx
                .select()
                .from(edgeState)
                .where(
                  and(
                    eq(edgeState.scopeId, foundScope.id),
                    inArray(edgeState.edgeId, edgeIds),
                  ),
                )
            : [];

        return {
          board: foundBoard,
          scope: foundScope,
          nodes,
          nodeStates: nodeStates.map(toNodeState),
          edges,
          edgeStates: edgeStates.map(toEdgeState),
          boardNodes: boardNodeRows.map(toBoardNode),
          boardEdges: boardEdgeRows.map(toBoardEdge),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async createNodeOnBoard(input: {
    boardId: string;
    node: GraphNode;
    placement: Pick<
      BoardNode,
      "x" | "y" | "width" | "height" | "zIndex" | "style"
    >;
  }): Promise<{ node: GraphNode; boardNode: BoardNode }> {
    return db.transaction(async (tx) => {
      const [foundBoard] = await tx
        .select({ storyId: board.storyId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);
      if (!foundBoard) throw new Error("Board not found");

      const [createdNode] = await tx.insert(graphNode).values(input.node).returning();
      const [createdBoardNode] = await tx
        .insert(boardNode)
        .values({
          boardId: input.boardId,
          nodeId: createdNode.id,
          storyId: foundBoard.storyId,
          ...input.placement,
        })
        .returning();

      await tx
        .update(board)
        .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
        .where(eq(board.id, input.boardId));

      return { node: createdNode, boardNode: toBoardNode(createdBoardNode) };
    });
  }

  async placeNodeOnBoard(input: {
    boardId: string;
    nodeId: string;
    placement: Pick<
      BoardNode,
      "x" | "y" | "width" | "height" | "zIndex" | "style"
    >;
  }): Promise<{ node: GraphNode; boardNode: BoardNode } | null> {
    return db.transaction(async (tx) => {
      const [foundBoard] = await tx
        .select({ storyId: board.storyId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);
      if (!foundBoard) return null;

      const [foundNode] = await tx
        .select()
        .from(graphNode)
        .where(
          and(
            eq(graphNode.id, input.nodeId),
            eq(graphNode.storyId, foundBoard.storyId),
          ),
        )
        .limit(1);
      if (!foundNode) return null;

      const [created] = await tx
        .insert(boardNode)
        .values({
          boardId: input.boardId,
          nodeId: input.nodeId,
          storyId: foundBoard.storyId,
          ...input.placement,
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        await tx
          .update(board)
          .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
          .where(eq(board.id, input.boardId));
        return { node: foundNode, boardNode: toBoardNode(created) };
      }

      const [existing] = await tx
        .select()
        .from(boardNode)
        .where(
          and(
            eq(boardNode.boardId, input.boardId),
            eq(boardNode.nodeId, input.nodeId),
          ),
        )
        .limit(1);
      return existing ? { node: foundNode, boardNode: toBoardNode(existing) } : null;
    });
  }

  async putNodeState(input: {
    scopeId: string;
    nodeId: string;
    expectedVersion: number | null;
    name: string | null;
    description: string | null;
    properties: NodeState["properties"];
  }): Promise<NodeState | "conflict" | null> {
    return db.transaction(async (tx) => {
      const [foundScope] = await tx
        .select({ storyId: scope.storyId })
        .from(scope)
        .where(eq(scope.id, input.scopeId))
        .limit(1);
      if (!foundScope) return null;

      const [foundNode] = await tx
        .select({ id: graphNode.id })
        .from(graphNode)
        .where(
          and(
            eq(graphNode.id, input.nodeId),
            eq(graphNode.storyId, foundScope.storyId),
          ),
        )
        .limit(1);
      if (!foundNode) return null;

      if (input.expectedVersion === null) {
        const [created] = await tx
          .insert(nodeState)
          .values({
            scopeId: input.scopeId,
            nodeId: input.nodeId,
            storyId: foundScope.storyId,
            name: input.name,
            description: input.description,
            properties: input.properties,
          })
          .onConflictDoNothing()
          .returning();
        return created ? toNodeState(created) : "conflict";
      }

      const [updated] = await tx
        .update(nodeState)
        .set({
          name: input.name,
          description: input.description,
          properties: input.properties,
          version: sql`${nodeState.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(nodeState.scopeId, input.scopeId),
            eq(nodeState.nodeId, input.nodeId),
            eq(nodeState.version, input.expectedVersion),
          ),
        )
        .returning();
      return updated ? toNodeState(updated) : "conflict";
    });
  }

  async putEdgeState(input: {
    scopeId: string;
    edgeId: string;
    expectedVersion: number | null;
    name: string | null;
    description: string | null;
    properties: EdgeState["properties"];
  }): Promise<EdgeState | "conflict" | null> {
    return db.transaction(async (tx) => {
      const [foundScope] = await tx
        .select({ storyId: scope.storyId })
        .from(scope)
        .where(eq(scope.id, input.scopeId))
        .limit(1);
      if (!foundScope) return null;

      const [foundEdge] = await tx
        .select({ id: graphEdge.id })
        .from(graphEdge)
        .where(
          and(
            eq(graphEdge.id, input.edgeId),
            eq(graphEdge.storyId, foundScope.storyId),
          ),
        )
        .limit(1);
      if (!foundEdge) return null;

      if (input.expectedVersion === null) {
        const [created] = await tx
          .insert(edgeState)
          .values({
            scopeId: input.scopeId,
            edgeId: input.edgeId,
            storyId: foundScope.storyId,
            name: input.name,
            description: input.description,
            properties: input.properties,
          })
          .onConflictDoNothing()
          .returning();
        return created ? toEdgeState(created) : "conflict";
      }

      const [updated] = await tx
        .update(edgeState)
        .set({
          name: input.name,
          description: input.description,
          properties: input.properties,
          version: sql`${edgeState.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(edgeState.scopeId, input.scopeId),
            eq(edgeState.edgeId, input.edgeId),
            eq(edgeState.version, input.expectedVersion),
          ),
        )
        .returning();
      return updated ? toEdgeState(updated) : "conflict";
    });
  }

  async updateNode(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: GraphNode["properties"];
  }): Promise<GraphNode | null> {
    const [updated] = await db
      .update(graphNode)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.properties !== undefined ? { properties: input.properties } : {}),
        version: sql`${graphNode.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(graphNode.id, input.id), eq(graphNode.version, input.expectedVersion)),
      )
      .returning();

    return updated ?? null;
  }

  async updateBoardNode(input: {
    boardId: string;
    nodeId: string;
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    style?: BoardNode["style"];
  }): Promise<BoardNode | null> {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(boardNode)
        .set({
          ...(input.x !== undefined ? { x: input.x } : {}),
          ...(input.y !== undefined ? { y: input.y } : {}),
          ...(input.width !== undefined ? { width: input.width } : {}),
          ...(input.height !== undefined ? { height: input.height } : {}),
          ...(input.zIndex !== undefined ? { zIndex: input.zIndex } : {}),
          ...(input.style !== undefined ? { style: input.style } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(eq(boardNode.boardId, input.boardId), eq(boardNode.nodeId, input.nodeId)),
        )
        .returning();

      if (!updated) return null;

      await tx
        .update(board)
        .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
        .where(eq(board.id, input.boardId));

      return toBoardNode(updated);
    });
  }

  async removeNodeFromBoard(boardId: string, nodeId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const deleted = await tx
        .delete(boardNode)
        .where(and(eq(boardNode.boardId, boardId), eq(boardNode.nodeId, nodeId)))
        .returning({ nodeId: boardNode.nodeId });

      if (deleted.length === 0) return false;

      const incidentEdges = await tx
        .select({ id: graphEdge.id })
        .from(graphEdge)
        .where(or(eq(graphEdge.sourceNodeId, nodeId), eq(graphEdge.targetNodeId, nodeId)));

      if (incidentEdges.length > 0) {
        await tx
          .delete(boardEdge)
          .where(
            and(
              eq(boardEdge.boardId, boardId),
              inArray(
                boardEdge.edgeId,
                incidentEdges.map((edge) => edge.id),
              ),
            ),
          );
      }

      await tx
        .update(board)
        .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
        .where(eq(board.id, boardId));
      return true;
    });
  }

  async restoreNodeToBoard(input: {
    boardId: string;
    nodeId: string;
    placement: Pick<
      BoardNode,
      "x" | "y" | "width" | "height" | "zIndex" | "style"
    >;
    boardEdges: Array<
      Pick<BoardEdge, "edgeId" | "style" | "labelPresentation">
    >;
  }): Promise<{
    node: GraphNode;
    boardNode: BoardNode;
    edges: GraphEdge[];
    boardEdges: BoardEdge[];
  } | null> {
    return db.transaction(async (tx) => {
      const [foundBoard] = await tx
        .select({ storyId: board.storyId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);
      if (!foundBoard) return null;

      const [foundNode] = await tx
        .select()
        .from(graphNode)
        .where(
          and(
            eq(graphNode.id, input.nodeId),
            eq(graphNode.storyId, foundBoard.storyId),
          ),
        )
        .limit(1);
      if (!foundNode) return null;

      const requestedEdgeIds = input.boardEdges.map((value) => value.edgeId);
      if (new Set(requestedEdgeIds).size !== requestedEdgeIds.length) return null;

      const foundEdges =
        requestedEdgeIds.length === 0
          ? []
          : await tx
              .select()
              .from(graphEdge)
              .where(
                and(
                  eq(graphEdge.storyId, foundBoard.storyId),
                  inArray(graphEdge.id, requestedEdgeIds),
                ),
              );
      if (foundEdges.length !== requestedEdgeIds.length) return null;

      const foundEdgeById = new Map(foundEdges.map((edge) => [edge.id, edge]));
      const requiredOtherEndpointIds = new Set<string>();
      for (const edgeId of requestedEdgeIds) {
        const edge = foundEdgeById.get(edgeId);
        if (!edge) return null;
        if (edge.sourceNodeId !== input.nodeId && edge.targetNodeId !== input.nodeId) {
          return null;
        }
        if (edge.sourceNodeId !== input.nodeId) requiredOtherEndpointIds.add(edge.sourceNodeId);
        if (edge.targetNodeId !== input.nodeId) requiredOtherEndpointIds.add(edge.targetNodeId);
      }

      if (requiredOtherEndpointIds.size > 0) {
        const representedEndpoints = await tx
          .select({ nodeId: boardNode.nodeId })
          .from(boardNode)
          .where(
            and(
              eq(boardNode.boardId, input.boardId),
              inArray(boardNode.nodeId, [...requiredOtherEndpointIds]),
            ),
          )
          .for("update");
        if (representedEndpoints.length !== requiredOtherEndpointIds.size) return null;
      }

      const [createdBoardNode] = await tx
        .insert(boardNode)
        .values({
          boardId: input.boardId,
          nodeId: foundNode.id,
          storyId: foundBoard.storyId,
          ...input.placement,
        })
        .onConflictDoNothing()
        .returning();

      const createdBoardEdges =
        input.boardEdges.length === 0
          ? []
          : await tx
              .insert(boardEdge)
              .values(
                input.boardEdges.map((restored) => ({
                  boardId: input.boardId,
                  edgeId: restored.edgeId,
                  storyId: foundBoard.storyId,
                  style: restored.style,
                  labelPresentation: restored.labelPresentation,
                })),
              )
              .onConflictDoNothing()
              .returning();

      if (createdBoardNode || createdBoardEdges.length > 0) {
        await tx
          .update(board)
          .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
          .where(eq(board.id, input.boardId));
      }

      const [restoredBoardNode] = await tx
        .select()
        .from(boardNode)
        .where(
          and(
            eq(boardNode.boardId, input.boardId),
            eq(boardNode.nodeId, input.nodeId),
          ),
        )
        .limit(1);
      if (!restoredBoardNode) return null;

      const restoredBoardEdges =
        requestedEdgeIds.length === 0
          ? []
          : await tx
              .select()
              .from(boardEdge)
              .where(
                and(
                  eq(boardEdge.boardId, input.boardId),
                  inArray(boardEdge.edgeId, requestedEdgeIds),
                ),
              );
      if (restoredBoardEdges.length !== requestedEdgeIds.length) return null;

      return {
        node: foundNode,
        boardNode: toBoardNode(restoredBoardNode),
        edges: requestedEdgeIds.map((edgeId) => foundEdgeById.get(edgeId)!),
        boardEdges: requestedEdgeIds.map((edgeId) =>
          toBoardEdge(restoredBoardEdges.find((row) => row.edgeId === edgeId)!),
        ),
      };
    });
  }

  async createEdgeOnBoard(input: {
    boardId: string;
    edge: GraphEdge;
  }): Promise<{ edge: GraphEdge; boardEdge: BoardEdge }> {
    return db.transaction(async (tx) => {
      const [foundBoard] = await tx
        .select({ storyId: board.storyId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);
      if (!foundBoard) throw new Error("Board not found");

      const [createdEdge] = await tx.insert(graphEdge).values(input.edge).returning();
      const [createdBoardEdge] = await tx
        .insert(boardEdge)
        .values({
          boardId: input.boardId,
          edgeId: createdEdge.id,
          storyId: foundBoard.storyId,
        })
        .returning();

      await tx
        .update(board)
        .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
        .where(eq(board.id, input.boardId));

      return { edge: createdEdge, boardEdge: toBoardEdge(createdBoardEdge) };
    });
  }

  async updateEdge(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: GraphEdge["properties"];
  }): Promise<GraphEdge | null> {
    const [updated] = await db
      .update(graphEdge)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.properties !== undefined ? { properties: input.properties } : {}),
        version: sql`${graphEdge.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(graphEdge.id, input.id), eq(graphEdge.version, input.expectedVersion)),
      )
      .returning();

    return updated ?? null;
  }

  async removeEdgeFromBoard(boardId: string, edgeId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const deleted = await tx
        .delete(boardEdge)
        .where(and(eq(boardEdge.boardId, boardId), eq(boardEdge.edgeId, edgeId)))
        .returning({ edgeId: boardEdge.edgeId });

      if (deleted.length === 0) return false;

      await tx
        .update(board)
        .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
        .where(eq(board.id, boardId));
      return true;
    });
  }

  async restoreEdgeToBoard(input: {
    boardId: string;
    edgeId: string;
    style: BoardEdge["style"];
    labelPresentation: BoardEdge["labelPresentation"];
  }): Promise<{ edge: GraphEdge; boardEdge: BoardEdge } | null> {
    return db.transaction(async (tx) => {
      const [foundBoard] = await tx
        .select({ storyId: board.storyId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);
      if (!foundBoard) return null;

      const [foundEdge] = await tx
        .select()
        .from(graphEdge)
        .where(
          and(
            eq(graphEdge.id, input.edgeId),
            eq(graphEdge.storyId, foundBoard.storyId),
          ),
        )
        .limit(1);
      if (!foundEdge) return null;

      const endpointIds = Array.from(
        new Set([foundEdge.sourceNodeId, foundEdge.targetNodeId]),
      );
      const representedEndpoints = await tx
        .select({ nodeId: boardNode.nodeId })
        .from(boardNode)
        .where(
          and(
            eq(boardNode.boardId, input.boardId),
            inArray(boardNode.nodeId, endpointIds),
          ),
        )
        .for("update");
      if (representedEndpoints.length !== endpointIds.length) return null;

      const [created] = await tx
        .insert(boardEdge)
        .values({
          boardId: input.boardId,
          edgeId: foundEdge.id,
          storyId: foundBoard.storyId,
          style: input.style,
          labelPresentation: input.labelPresentation,
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        await tx
          .update(board)
          .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
          .where(eq(board.id, input.boardId));
        return { edge: foundEdge, boardEdge: toBoardEdge(created) };
      }

      const [existing] = await tx
        .select()
        .from(boardEdge)
        .where(
          and(
            eq(boardEdge.boardId, input.boardId),
            eq(boardEdge.edgeId, input.edgeId),
          ),
        )
        .limit(1);
      return existing
        ? { edge: foundEdge, boardEdge: toBoardEdge(existing) }
        : null;
    });
  }
}
