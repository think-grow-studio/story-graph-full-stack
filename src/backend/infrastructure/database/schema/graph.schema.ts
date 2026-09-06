import {
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import type { JsonObject } from "@/backend/modules/graph/domain/graph";
import { story } from "./story.schema";

export const board = pgTable(
  "board",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => story.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("board_story_id_idx").on(table.storyId)],
);

export const graphNode = pgTable(
  "graph_node",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    iconKey: text("icon_key"),
    properties: jsonb("properties").$type<JsonObject>().default({}).notNull(),
    x: doublePrecision("x").default(0).notNull(),
    y: doublePrecision("y").default(0).notNull(),
    width: doublePrecision("width"),
    height: doublePrecision("height"),
    zIndex: integer("z_index").default(0).notNull(),
    style: jsonb("style").$type<JsonObject>().default({}).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("graph_node_id_board_id_unique").on(table.id, table.boardId),
    index("graph_node_board_id_idx").on(table.boardId),
  ],
);

export const graphEdge = pgTable(
  "graph_edge",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    iconKey: text("icon_key"),
    properties: jsonb("properties").$type<JsonObject>().default({}).notNull(),
    style: jsonb("style").$type<JsonObject>().default({}).notNull(),
    labelPresentation: jsonb("label_presentation")
      .$type<JsonObject>()
      .default({})
      .notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("graph_edge_id_board_id_unique").on(table.id, table.boardId),
    index("graph_edge_board_id_idx").on(table.boardId),
    index("graph_edge_source_node_id_idx").on(table.sourceNodeId),
    index("graph_edge_target_node_id_idx").on(table.targetNodeId),
    foreignKey({
      name: "graph_edge_source_board_fk",
      columns: [table.sourceNodeId, table.boardId],
      foreignColumns: [graphNode.id, graphNode.boardId],
    }).onDelete("cascade"),
    foreignKey({
      name: "graph_edge_target_board_fk",
      columns: [table.targetNodeId, table.boardId],
      foreignColumns: [graphNode.id, graphNode.boardId],
    }).onDelete("cascade"),
  ],
);
