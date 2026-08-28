import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { story } from "./story.schema";

export type GraphProperties = Record<string, unknown>;

export const graphNode = pgTable(
  "graph_node",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => story.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    iconKey: text("icon_key"),
    properties: jsonb("properties").$type<GraphProperties>().default({}).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("graph_node_storyId_idx").on(table.storyId)],
);

export const graphEdge = pgTable(
  "graph_edge",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => story.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => graphNode.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => graphNode.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    iconKey: text("icon_key"),
    properties: jsonb("properties").$type<GraphProperties>().default({}).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("graph_edge_storyId_idx").on(table.storyId),
    index("graph_edge_sourceNodeId_idx").on(table.sourceNodeId),
    index("graph_edge_targetNodeId_idx").on(table.targetNodeId),
  ],
);
