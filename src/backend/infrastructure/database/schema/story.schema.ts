import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth.schema";

export const story = pgTable(
  "story",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("story_workspaceId_idx").on(table.workspaceId)],
);
