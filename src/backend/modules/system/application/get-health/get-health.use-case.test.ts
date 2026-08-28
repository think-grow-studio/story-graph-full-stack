import { describe, expect, it } from "vitest";

import { getHealth } from "./get-health.use-case";

describe("getHealth", () => {
  it("returns the health contract", () => {
    expect(getHealth()).toEqual({ status: "ok" });
  });
});
