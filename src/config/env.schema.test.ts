import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv } from "./env.schema";

const validServerEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://story_graph:story_graph@localhost:5432/story_graph",
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
} as const;

describe("environment schemas", () => {
  it("defaults the client API URL", () => {
    expect(parseClientEnv({}).NEXT_PUBLIC_API_BASE_URL).toBe("/api/v1");
  });

  it("accepts a valid server environment", () => {
    expect(parseServerEnv(validServerEnv)).toEqual(validServerEnv);
  });

  it("rejects a missing database URL", () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        DATABASE_URL: undefined,
      }),
    ).toThrow();
  });

  it("rejects a short Better Auth secret", () => {
    expect(() =>
      parseServerEnv({ ...validServerEnv, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow();
  });

  it("requires Google OAuth credentials", () => {
    expect(() =>
      parseServerEnv({ ...validServerEnv, GOOGLE_CLIENT_ID: undefined }),
    ).toThrow();
    expect(() =>
      parseServerEnv({ ...validServerEnv, GOOGLE_CLIENT_SECRET: undefined }),
    ).toThrow();
  });

  it("rejects an invalid server environment", () => {
    expect(() => parseServerEnv({ ...validServerEnv, NODE_ENV: "invalid" })).toThrow();
  });
});
