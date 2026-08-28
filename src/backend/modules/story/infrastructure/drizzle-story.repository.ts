import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/backend/infrastructure/database/client";
import { story as storyTable } from "@/backend/infrastructure/database/schema";
import type { Story } from "../domain/story";
import type { StoryRepository } from "../domain/story.repository";

export class DrizzleStoryRepository implements StoryRepository {
  async create(story: Story): Promise<Story> {
    const [created] = await db.insert(storyTable).values(story).returning();
    return created;
  }

  async findById(id: string): Promise<Story | null> {
    const [found] = await db.select().from(storyTable).where(eq(storyTable.id, id)).limit(1);
    return found ?? null;
  }

  async listByWorkspace(workspaceId: string): Promise<Story[]> {
    return db.select().from(storyTable).where(eq(storyTable.workspaceId, workspaceId));
  }

  async update(input: {
    id: string;
    name?: string;
    description?: string;
  }): Promise<Story | null> {
    const values: Partial<Pick<Story, "name" | "description" | "updatedAt">> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.description !== undefined) {
      values.description = input.description;
    }

    const [updated] = await db
      .update(storyTable)
      .set(values)
      .where(eq(storyTable.id, input.id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await db
      .delete(storyTable)
      .where(eq(storyTable.id, id))
      .returning({ id: storyTable.id });

    return deleted.length > 0;
  }
}
