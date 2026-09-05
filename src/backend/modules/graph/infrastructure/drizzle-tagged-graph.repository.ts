import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/backend/infrastructure/database/client";
import { board, boardTag } from "@/backend/infrastructure/database/schema";
import type { Board, BoardSnapshot } from "../domain/graph";
import { DrizzleGraphRepository } from "./drizzle-graph.repository";

type TaggedBoard = Board & { tags: string[] };

function groupTags(rows: Array<{ boardId: string; name: string }>) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const tags = result.get(row.boardId) ?? [];
    tags.push(row.name);
    result.set(row.boardId, tags);
  }
  return result;
}

export class DrizzleTaggedGraphRepository extends DrizzleGraphRepository {
  override async createBoard(input: {
    storyId: string;
    scopeId?: string | null;
    name: string;
    description: string;
    tags?: string[];
  }): Promise<TaggedBoard> {
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(board)
        .values({
          id: crypto.randomUUID(),
          storyId: input.storyId,
          scopeId: input.scopeId ?? null,
          name: input.name,
          description: input.description,
        })
        .returning();
      const tags = input.tags ?? [];
      if (tags.length > 0) {
        await tx.insert(boardTag).values(tags.map((name) => ({ boardId: created.id, name })));
      }
      return { ...created, tags };
    });
  }

  override async listBoards(storyId: string): Promise<TaggedBoard[]> {
    const boards = await db
      .select()
      .from(board)
      .where(eq(board.storyId, storyId))
      .orderBy(asc(board.createdAt), asc(board.id));
    if (boards.length === 0) return [];
    const tags = await db
      .select({ boardId: boardTag.boardId, name: boardTag.name })
      .from(boardTag)
      .where(inArray(boardTag.boardId, boards.map((value) => value.id)))
      .orderBy(asc(boardTag.createdAt), asc(boardTag.name));
    const byBoard = groupTags(tags);
    return boards.map((value) => ({ ...value, tags: byBoard.get(value.id) ?? [] }));
  }

  override async findBoard(id: string): Promise<TaggedBoard | null> {
    const [found] = await db.select().from(board).where(eq(board.id, id)).limit(1);
    if (!found) return null;
    const tags = await db
      .select({ name: boardTag.name })
      .from(boardTag)
      .where(eq(boardTag.boardId, id))
      .orderBy(asc(boardTag.createdAt), asc(boardTag.name));
    return { ...found, tags: tags.map((value) => value.name) };
  }

  override async getBoardSnapshot(boardId: string): Promise<BoardSnapshot | null> {
    const snapshot = await super.getBoardSnapshot(boardId);
    if (!snapshot) return null;
    const tags = await db
      .select({ name: boardTag.name })
      .from(boardTag)
      .where(eq(boardTag.boardId, boardId))
      .orderBy(asc(boardTag.createdAt), asc(boardTag.name));
    return {
      ...snapshot,
      board: { ...snapshot.board, tags: tags.map((value) => value.name) } as TaggedBoard,
    };
  }
}
