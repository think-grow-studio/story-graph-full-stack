import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv } from "./env.schema";

describe("environment schemas", () => {
  it("defaults the client API URL", () => {
    expect(parseClientEnv({}).NEXT_PUBLIC_API_BASE_URL).toBe("/api/v1");
  });

  it("accepts a valid server environment", () => {
    expect(parseServerEnv({ NODE_ENV: "test" }).NODE_ENV).toBe("test");
  });

  it("rejects an invalid server environment", () => {
    expect(() => parseServerEnv({ NODE_ENV: "invalid" })).toThrow();
  });
});
