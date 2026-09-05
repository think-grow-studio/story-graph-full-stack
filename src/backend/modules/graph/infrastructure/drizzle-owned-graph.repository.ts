import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardEdge,
  boardNode,
  graphEdge,
  graphNode,
} from "@/backend/infrastructure/database/schema";
import type { BoardEdge, BoardNode, GraphEdge, GraphNode } from "../domain/graph";
import { DrizzleTaggedGraphRepository } from "./drizzle-tagged-graph.repository";

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

export class DrizzleOwnedGraphRepository extends DrizzleTaggedGraphRepository {
  override async createNodeOnBoard(input: {
    boardId: string;
    node: GraphNode;
    placement: Pick<BoardNode, "x" | "y" | "width" | "height" | "zIndex" | "style">;
  }): Promise<{ node: GraphNode; boardNode: BoardNode }> {
    return db.transaction(async (tx) => {
      const [foundBoard] = await tx
        .select({ storyId: board.storyId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);
      if (!foundBoard) throw new Error("Board not found");

      const [createdNode] = await tx
        .insert(graphNode)
        .values({
          ...input.node,
          boardId: input.boardId,
          x: input.placement.x,
          y: input.placement.y,
          width: input.placement.width,
          height: input.placement.height,
          zIndex: input.placement.zIndex,
          style: input.placement.style,
        })
        .returning();
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

  override async placeNodeOnBoard(input: {
    boardId: string;
    nodeId: string;
    placement: Pick<BoardNode, "x" | "y" | "width" | "height" | "zIndex" | "style">;
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
        .where(and(eq(graphNode.id, input.nodeId), eq(graphNode.storyId, foundBoard.storyId)))
        .limit(1);
      if (!foundNode) return null;
      if (foundNode.boardId && foundNode.boardId !== input.boardId) return null;

      const [claimedNode] = await tx
        .update(graphNode)
        .set({
          boardId: input.boardId,
          x: input.placement.x,
          y: input.placement.y,
          width: input.placement.width,
          height: input.placement.height,
          zIndex: input.placement.zIndex,
          style: input.placement.style,
          updatedAt: new Date(),
        })
        .where(eq(graphNode.id, input.nodeId))
        .returning();

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
        return { node: claimedNode, boardNode: toBoardNode(created) };
      }

      const [existing] = await tx
        .select()
        .from(boardNode)
        .where(and(eq(boardNode.boardId, input.boardId), eq(boardNode.nodeId, input.nodeId)))
        .limit(1);
      return existing ? { node: claimedNode, boardNode: toBoardNode(existing) } : null;
    });
  }

  override async updateBoardNode(input: {
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
        .where(and(eq(boardNode.boardId, input.boardId), eq(boardNode.nodeId, input.nodeId)))
        .returning();
      if (!updated) return null;

      await tx
        .update(graphNode)
        .set({
          ...(input.x !== undefined ? { x: input.x } : {}),
          ...(input.y !== undefined ? { y: input.y } : {}),
          ...(input.width !== undefined ? { width: input.width } : {}),
          ...(input.height !== undefined ? { height: input.height } : {}),
          ...(input.zIndex !== undefined ? { zIndex: input.zIndex } : {}),
          ...(input.style !== undefined ? { style: input.style } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(graphNode.id, input.nodeId), eq(graphNode.boardId, input.boardId)));

      await tx
        .update(board)
        .set({ revision: sql`${board.revision} + 1`, updatedAt: new Date() })
        .where(eq(board.id, input.boardId));
      return toBoardNode(updated);
    });
  }

  override async createEdgeOnBoard(input: {
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

      const endpoints = await tx
        .select({ id: graphNode.id })
        .from(graphNode)
        .where(
          and(
            eq(graphNode.boardId, input.boardId),
            sql`${graphNode.id} in (${input.edge.sourceNodeId}, ${input.edge.targetNodeId})`,
          ),
        );
      const endpointIds = new Set(endpoints.map((value) => value.id));
      if (!endpointIds.has(input.edge.sourceNodeId) || !endpointIds.has(input.edge.targetNodeId)) {
        throw new Error("Edge endpoints must belong to the Board");
      }

      const [createdEdge] = await tx
        .insert(graphEdge)
        .values({ ...input.edge, boardId: input.boardId })
        .returning();
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
      return { edge: createdEdge, boardEdge: createdBoardEdge };
    });
  }
}
