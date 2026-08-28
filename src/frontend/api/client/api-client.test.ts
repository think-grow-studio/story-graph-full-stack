import { describe, expect, it } from "vitest";

import { apiClient } from "./api-client";

describe("apiClient", () => {
  it("uses the versioned HTTP boundary and cookies", () => {
    expect(apiClient.defaults.baseURL).toBe("/api/v1");
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});
