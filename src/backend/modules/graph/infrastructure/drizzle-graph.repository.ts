import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardEdge,
  boardNode,
  graphEdge,
  graphNode,
} from "@/backend/infrastructure/database/schema";
import type {
  Board,
  BoardEdge,
  BoardNode,
  BoardSnapshot,
  GraphEdge,
  GraphNode,
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

export class DrizzleGraphRepository implements GraphRepository {
  async createBoard(input: {
    storyId: string;
    name: string;
    description: string;
  }): Promise<Board> {
    const [created] = await db
      .insert(board)
      .values({ id: crypto.randomUUID(), ...input })
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
        if (!foundBoard) {
          return null;
        }

        const boardNodeRows = await tx
          .select()
          .from(boardNode)
          .where(eq(boardNode.boardId, boardId));
        const nodeIds = boardNodeRows.map((row) => row.nodeId);
        const nodes =
          nodeIds.length === 0
            ? []
            : await tx.select().from(graphNode).where(inArray(graphNode.id, nodeIds));

        const boardEdgeRows = await tx
          .select()
          .from(boardEdge)
          .where(eq(boardEdge.boardId, boardId));
        const edgeIds = boardEdgeRows.map((row) => row.edgeId);
        const edges =
          edgeIds.length === 0
            ? []
            : await tx.select().from(graphEdge).where(inArray(graphEdge.id, edgeIds));

        return {
          board: foundBoard,
          nodes,
          edges,
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
      if (!foundBoard) {
        throw new Error("Board not found");
      }

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

      if (!updated) {
        return null;
      }

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

      if (deleted.length === 0) {
        return false;
      }

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
      if (!foundBoard) {
        throw new Error("Board not found");
      }

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

      if (deleted.length === 0) {
        return false;
      }

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
