import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { board } from "./graph.schema";

export const boardTag = pgTable(
  "board_tag",
  {
    boardId: text("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: "board_tag_pk", columns: [table.boardId, table.name] }),
    index("board_tag_board_id_idx").on(table.boardId),
  ],
);
