import {
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import type { JsonObject } from "@/backend/modules/graph/domain/graph";
import { story } from "./story.schema";

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
    properties: jsonb("properties").$type<JsonObject>().default({}).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("graph_node_id_story_id_unique").on(table.id, table.storyId),
    index("graph_node_story_id_idx").on(table.storyId),
  ],
);

export const graphEdge = pgTable(
  "graph_edge",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => story.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    iconKey: text("icon_key"),
    properties: jsonb("properties").$type<JsonObject>().default({}).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("graph_edge_id_story_id_unique").on(table.id, table.storyId),
    index("graph_edge_story_id_idx").on(table.storyId),
    index("graph_edge_source_node_id_idx").on(table.sourceNodeId),
    index("graph_edge_target_node_id_idx").on(table.targetNodeId),
    foreignKey({
      name: "graph_edge_source_story_fk",
      columns: [table.sourceNodeId, table.storyId],
      foreignColumns: [graphNode.id, graphNode.storyId],
    }).onDelete("cascade"),
    foreignKey({
      name: "graph_edge_target_story_fk",
      columns: [table.targetNodeId, table.storyId],
      foreignColumns: [graphNode.id, graphNode.storyId],
    }).onDelete("cascade"),
  ],
);

export const board = pgTable(
  "board",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => story.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    revision: integer("revision").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("board_id_story_id_unique").on(table.id, table.storyId),
    index("board_story_id_idx").on(table.storyId),
  ],
);

export const boardNode = pgTable(
  "board_node",
  {
    boardId: text("board_id").notNull(),
    nodeId: text("node_id").notNull(),
    storyId: text("story_id").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    width: doublePrecision("width"),
    height: doublePrecision("height"),
    zIndex: integer("z_index").default(0).notNull(),
    style: jsonb("style").$type<JsonObject>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "board_node_pk",
      columns: [table.boardId, table.nodeId],
    }),
    index("board_node_story_id_idx").on(table.storyId),
    index("board_node_node_id_idx").on(table.nodeId),
    foreignKey({
      name: "board_node_board_story_fk",
      columns: [table.boardId, table.storyId],
      foreignColumns: [board.id, board.storyId],
    }).onDelete("cascade"),
    foreignKey({
      name: "board_node_node_story_fk",
      columns: [table.nodeId, table.storyId],
      foreignColumns: [graphNode.id, graphNode.storyId],
    }).onDelete("cascade"),
  ],
);

export const boardEdge = pgTable(
  "board_edge",
  {
    boardId: text("board_id").notNull(),
    edgeId: text("edge_id").notNull(),
    storyId: text("story_id").notNull(),
    style: jsonb("style").$type<JsonObject>().default({}).notNull(),
    labelPresentation: jsonb("label_presentation")
      .$type<JsonObject>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "board_edge_pk",
      columns: [table.boardId, table.edgeId],
    }),
    index("board_edge_story_id_idx").on(table.storyId),
    index("board_edge_edge_id_idx").on(table.edgeId),
    foreignKey({
      name: "board_edge_board_story_fk",
      columns: [table.boardId, table.storyId],
      foreignColumns: [board.id, board.storyId],
    }).onDelete("cascade"),
    foreignKey({
      name: "board_edge_edge_story_fk",
      columns: [table.edgeId, table.storyId],
      foreignColumns: [graphEdge.id, graphEdge.storyId],
    }).onDelete("cascade"),
  ],
);
