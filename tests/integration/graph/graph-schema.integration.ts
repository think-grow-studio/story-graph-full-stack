import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { pool } from "@/backend/infrastructure/database/client";

describe("graph database schema", () => {
  it("provides canonical node and edge tables", async () => {
    const result = await pool.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name in ('graph_node', 'graph_edge')
       order by table_name`,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual(["graph_edge", "graph_node"]);
  });
});
