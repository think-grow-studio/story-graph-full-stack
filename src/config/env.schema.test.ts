import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv } from "./env.schema";

const validServerEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://story_graph:story_graph@localhost:5432/story_graph",
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "http://localhost:3000",
} as const;

describe("environment schemas", () => {
  it("defaults the client API URL", () => {
    expect(parseClientEnv({}).NEXT_PUBLIC_API_BASE_URL).toBe("/api/v1");
  });

  it("accepts a valid server environment", () => {
    expect(parseServerEnv(validServerEnv)).toEqual(validServerEnv);
  });

  it("rejects a missing database URL", () => {
    const { DATABASE_URL: _databaseUrl, ...withoutDatabaseUrl } = validServerEnv;

    expect(() => parseServerEnv(withoutDatabaseUrl)).toThrow();
  });

  it("rejects a short Better Auth secret", () => {
    expect(() =>
      parseServerEnv({ ...validServerEnv, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow();
  });

  it("rejects an invalid server environment", () => {
    expect(() => parseServerEnv({ ...validServerEnv, NODE_ENV: "invalid" })).toThrow();
  });
});
