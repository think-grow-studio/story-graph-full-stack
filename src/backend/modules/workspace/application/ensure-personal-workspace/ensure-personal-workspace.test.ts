import { describe, expect, it } from "vitest";

import { personalWorkspaceSlug } from "./ensure-personal-workspace";

describe("personalWorkspaceSlug", () => {
  it("produces a deterministic safe slug from a user id", () => {
    expect(personalWorkspaceSlug("User_ABC:123")).toBe("personal-user-abc-123");
    expect(personalWorkspaceSlug("User_ABC:123")).toBe("personal-user-abc-123");
  });
});
