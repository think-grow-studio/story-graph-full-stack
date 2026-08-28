import { and, eq, sql } from "drizzle-orm";

import { db } from "@/backend/infrastructure/database/client";
import { graphNode } from "@/backend/infrastructure/database/schema";
import type { GraphNode } from "../domain/graph-node";
import type { GraphNodeUpdateResult, GraphRepository } from "../domain/graph.repository";

export class DrizzleGraphRepository implements GraphRepository {
  async createNode(node: GraphNode): Promise<GraphNode> {
    const [created] = await db.insert(graphNode).values(node).returning();
    return created;
  }

  async findNodeById(id: string): Promise<GraphNode | null> {
    const [found] = await db.select().from(graphNode).where(eq(graphNode.id, id)).limit(1);
    return found ?? null;
  }

  async listNodesByStory(storyId: string): Promise<GraphNode[]> {
    return db.select().from(graphNode).where(eq(graphNode.storyId, storyId));
  }

  async updateNode(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: Record<string, unknown>;
  }): Promise<GraphNodeUpdateResult> {
    const [updated] = await db
      .update(graphNode)
      .set({
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.iconKey === undefined ? {} : { iconKey: input.iconKey }),
        ...(input.properties === undefined ? {} : { properties: input.properties }),
        version: sql`${graphNode.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(graphNode.id, input.id), eq(graphNode.version, input.expectedVersion)))
      .returning();

    if (updated) {
      return { kind: "updated", node: updated };
    }

    const [existing] = await db
      .select({ id: graphNode.id })
      .from(graphNode)
      .where(eq(graphNode.id, input.id))
      .limit(1);

    return existing ? { kind: "conflict" } : { kind: "not-found" };
  }

  async deleteNode(id: string): Promise<boolean> {
    const deleted = await db
      .delete(graphNode)
      .where(eq(graphNode.id, id))
      .returning({ id: graphNode.id });
    return deleted.length > 0;
  }
}
