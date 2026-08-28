import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

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
  const { storyId: _storyId, ...value } = row;
  return value;
}

function toBoardEdge(row: typeof boardEdge.$inferSelect): BoardEdge {
  const { storyId: _storyId, ...value } = row;
  return value;
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
}
