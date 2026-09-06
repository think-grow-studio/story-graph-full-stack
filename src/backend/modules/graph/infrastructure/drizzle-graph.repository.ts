import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardTag,
  graphEdge,
  graphNode,
} from "@/backend/infrastructure/database/schema";
import type {
  Board,
  BoardSnapshot,
  CreateGraphEdge,
  CreateGraphNode,
  DeletedNodeSnapshot,
  GraphEdge,
  GraphNode,
  RestorableGraphEdge,
  RestorableGraphNode,
} from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";

function sortTags(tags: string[]) {
  return [...tags].sort((left, right) => left.localeCompare(right));
}

export class DrizzleGraphRepository implements GraphRepository {
  async createBoard(input: {
    storyId: string;
    name: string;
    description: string;
    tags: string[];
  }): Promise<Board> {
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(board)
        .values({
          id: crypto.randomUUID(),
          storyId: input.storyId,
          name: input.name,
          description: input.description,
        })
        .returning();

      if (input.tags.length > 0) {
        await tx.insert(boardTag).values(
          input.tags.map((name) => ({ boardId: created.id, name })),
        );
      }

      return { ...created, tags: sortTags(input.tags) };
    });
  }

  async updateBoard(input: {
    id: string;
    name?: string;
    description?: string;
    tags?: string[];
  }): Promise<Board | null> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(board)
        .where(eq(board.id, input.id))
        .limit(1);
      if (!existing) return null;

      let updated = existing;
      if (input.name !== undefined || input.description !== undefined) {
        const [next] = await tx
          .update(board)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(board.id, input.id))
          .returning();
        updated = next;
      }

      if (input.tags !== undefined) {
        await tx.delete(boardTag).where(eq(boardTag.boardId, input.id));
        if (input.tags.length > 0) {
          await tx.insert(boardTag).values(
            input.tags.map((name) => ({ boardId: input.id, name })),
          );
        }
      }

      const tagRows = await tx
        .select({ name: boardTag.name })
        .from(boardTag)
        .where(eq(boardTag.boardId, input.id))
        .orderBy(asc(boardTag.name));

      return { ...updated, tags: tagRows.map((row) => row.name) };
    });
  }

  async listBoards(storyId: string): Promise<Board[]> {
    const rows = await db
      .select()
      .from(board)
      .where(eq(board.storyId, storyId))
      .orderBy(asc(board.createdAt), asc(board.id));
    if (rows.length === 0) return [];

    const tags = await db
      .select({ boardId: boardTag.boardId, name: boardTag.name })
      .from(boardTag)
      .where(inArray(boardTag.boardId, rows.map((row) => row.id)))
      .orderBy(asc(boardTag.name));
    const tagsByBoard = new Map<string, string[]>();
    for (const tag of tags) {
      const values = tagsByBoard.get(tag.boardId) ?? [];
      values.push(tag.name);
      tagsByBoard.set(tag.boardId, values);
    }

    return rows.map((row) => ({
      ...row,
      tags: tagsByBoard.get(row.id) ?? [],
    }));
  }

  async findBoard(id: string): Promise<Board | null> {
    const [found] = await db.select().from(board).where(eq(board.id, id)).limit(1);
    if (!found) return null;

    const tagRows = await db
      .select({ name: boardTag.name })
      .from(boardTag)
      .where(eq(boardTag.boardId, id))
      .orderBy(asc(boardTag.name));
    return { ...found, tags: tagRows.map((row) => row.name) };
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

        const [tagRows, nodes, edges] = await Promise.all([
          tx
            .select({ name: boardTag.name })
            .from(boardTag)
            .where(eq(boardTag.boardId, boardId))
            .orderBy(asc(boardTag.name)),
          tx
            .select()
            .from(graphNode)
            .where(eq(graphNode.boardId, boardId))
            .orderBy(asc(graphNode.createdAt), asc(graphNode.id)),
          tx
            .select()
            .from(graphEdge)
            .where(eq(graphEdge.boardId, boardId))
            .orderBy(asc(graphEdge.createdAt), asc(graphEdge.id)),
        ]);

        return {
          board: { ...foundBoard, tags: tagRows.map((row) => row.name) },
          nodes,
          edges,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async createNode(input: CreateGraphNode): Promise<GraphNode> {
    const [created] = await db.insert(graphNode).values(input).returning();
    return created;
  }

  async findNode(boardId: string, nodeId: string): Promise<GraphNode | null> {
    const [found] = await db
      .select()
      .from(graphNode)
      .where(and(eq(graphNode.boardId, boardId), eq(graphNode.id, nodeId)))
      .limit(1);
    return found ?? null;
  }

  async updateNode(input: {
    boardId: string;
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: GraphNode["properties"];
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    style?: GraphNode["style"];
  }): Promise<GraphNode | null> {
    const [updated] = await db
      .update(graphNode)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.properties !== undefined
          ? { properties: input.properties }
          : {}),
        ...(input.x !== undefined ? { x: input.x } : {}),
        ...(input.y !== undefined ? { y: input.y } : {}),
        ...(input.width !== undefined ? { width: input.width } : {}),
        ...(input.height !== undefined ? { height: input.height } : {}),
        ...(input.zIndex !== undefined ? { zIndex: input.zIndex } : {}),
        ...(input.style !== undefined ? { style: input.style } : {}),
        version: sql`${graphNode.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(graphNode.boardId, input.boardId),
          eq(graphNode.id, input.id),
          eq(graphNode.version, input.expectedVersion),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async deleteNode(
    boardId: string,
    nodeId: string,
  ): Promise<DeletedNodeSnapshot | null> {
    return db.transaction(async (tx) => {
      const [node] = await tx
        .select()
        .from(graphNode)
        .where(and(eq(graphNode.boardId, boardId), eq(graphNode.id, nodeId)))
        .limit(1);
      if (!node) return null;

      const edges = await tx
        .select()
        .from(graphEdge)
        .where(
          and(
            eq(graphEdge.boardId, boardId),
            or(
              eq(graphEdge.sourceNodeId, nodeId),
              eq(graphEdge.targetNodeId, nodeId),
            ),
          ),
        )
        .orderBy(asc(graphEdge.createdAt), asc(graphEdge.id));

      await tx
        .delete(graphNode)
        .where(and(eq(graphNode.boardId, boardId), eq(graphNode.id, nodeId)));
      return { node, edges };
    });
  }

  async restoreNode(input: {
    boardId: string;
    node: RestorableGraphNode;
    edges: RestorableGraphEdge[];
  }): Promise<{ node: GraphNode; edges: GraphEdge[] } | null> {
    if (input.node.boardId !== input.boardId) return null;
    if (
      input.edges.some(
        (edge) =>
          edge.boardId !== input.boardId ||
          (edge.sourceNodeId !== input.node.id &&
            edge.targetNodeId !== input.node.id),
      )
    ) {
      return null;
    }

    return db.transaction(async (tx) => {
      const [occupiedNode] = await tx
        .select({ id: graphNode.id })
        .from(graphNode)
        .where(eq(graphNode.id, input.node.id))
        .limit(1);
      if (occupiedNode) return null;

      if (input.edges.length > 0) {
        const occupiedEdges = await tx
          .select({ id: graphEdge.id })
          .from(graphEdge)
          .where(inArray(graphEdge.id, input.edges.map((edge) => edge.id)))
          .limit(1);
        if (occupiedEdges.length > 0) return null;
      }

      const otherEndpointIds = [
        ...new Set(
          input.edges.flatMap((edge) =>
            [edge.sourceNodeId, edge.targetNodeId].filter(
              (id) => id !== input.node.id,
            ),
          ),
        ),
      ];
      if (otherEndpointIds.length > 0) {
        const existingEndpoints = await tx
          .select({ id: graphNode.id })
          .from(graphNode)
          .where(
            and(
              eq(graphNode.boardId, input.boardId),
              inArray(graphNode.id, otherEndpointIds),
            ),
          );
        if (existingEndpoints.length !== otherEndpointIds.length) return null;
      }

      const [restoredNode] = await tx
        .insert(graphNode)
        .values(input.node)
        .returning();
      const restoredEdges =
        input.edges.length === 0
          ? []
          : await tx.insert(graphEdge).values(input.edges).returning();
      return { node: restoredNode, edges: restoredEdges };
    });
  }

  async createEdge(input: CreateGraphEdge): Promise<GraphEdge> {
    const [created] = await db.insert(graphEdge).values(input).returning();
    return created;
  }

  async findEdge(boardId: string, edgeId: string): Promise<GraphEdge | null> {
    const [found] = await db
      .select()
      .from(graphEdge)
      .where(and(eq(graphEdge.boardId, boardId), eq(graphEdge.id, edgeId)))
      .limit(1);
    return found ?? null;
  }

  async updateEdge(input: {
    boardId: string;
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: GraphEdge["properties"];
    style?: GraphEdge["style"];
    labelPresentation?: GraphEdge["labelPresentation"];
  }): Promise<GraphEdge | null> {
    const [updated] = await db
      .update(graphEdge)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.properties !== undefined
          ? { properties: input.properties }
          : {}),
        ...(input.style !== undefined ? { style: input.style } : {}),
        ...(input.labelPresentation !== undefined
          ? { labelPresentation: input.labelPresentation }
          : {}),
        version: sql`${graphEdge.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(graphEdge.boardId, input.boardId),
          eq(graphEdge.id, input.id),
          eq(graphEdge.version, input.expectedVersion),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async deleteEdge(boardId: string, edgeId: string): Promise<GraphEdge | null> {
    const [deleted] = await db
      .delete(graphEdge)
      .where(and(eq(graphEdge.boardId, boardId), eq(graphEdge.id, edgeId)))
      .returning();
    return deleted ?? null;
  }

  async restoreEdge(input: {
    boardId: string;
    edge: RestorableGraphEdge;
  }): Promise<GraphEdge | null> {
    if (input.edge.boardId !== input.boardId) return null;

    return db.transaction(async (tx) => {
      const [occupied] = await tx
        .select({ id: graphEdge.id })
        .from(graphEdge)
        .where(eq(graphEdge.id, input.edge.id))
        .limit(1);
      if (occupied) return null;

      const endpoints = await tx
        .select({ id: graphNode.id })
        .from(graphNode)
        .where(
          and(
            eq(graphNode.boardId, input.boardId),
            inArray(graphNode.id, [
              input.edge.sourceNodeId,
              input.edge.targetNodeId,
            ]),
          ),
        );
      const endpointIds = new Set(endpoints.map((row) => row.id));
      if (
        !endpointIds.has(input.edge.sourceNodeId) ||
        !endpointIds.has(input.edge.targetNodeId)
      ) {
        return null;
      }

      const [restored] = await tx
        .insert(graphEdge)
        .values(input.edge)
        .returning();
      return restored;
    });
  }
}
