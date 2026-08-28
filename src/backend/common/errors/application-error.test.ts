import { describe, expect, it } from "vitest";

import { ApplicationError } from "./application-error";

describe("ApplicationError", () => {
  it("represents optimistic locking conflicts as 409", () => {
    const error = new ApplicationError("CONFLICT", 409);

    expect(error.code).toBe("CONFLICT");
    expect(error.status).toBe(409);
  });
});
