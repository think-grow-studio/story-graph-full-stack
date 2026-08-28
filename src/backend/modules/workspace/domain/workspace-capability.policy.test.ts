import { describe, expect, it } from "vitest";

import type { WorkspaceCapability } from "./workspace-access.service";
import { workspaceRoleHasCapability } from "./workspace-capability.policy";

describe("workspaceRoleHasCapability graph capabilities", () => {
  const graphRead = "graph:read" as WorkspaceCapability;
  const graphUpdate = "graph:update" as WorkspaceCapability;

  it("allows owners and admins to read and update graph data", () => {
    expect(workspaceRoleHasCapability("owner", graphRead)).toBe(true);
    expect(workspaceRoleHasCapability("owner", graphUpdate)).toBe(true);
    expect(workspaceRoleHasCapability("admin", graphRead)).toBe(true);
    expect(workspaceRoleHasCapability("admin", graphUpdate)).toBe(true);
  });

  it("allows members to read graph data but not update it", () => {
    expect(workspaceRoleHasCapability("member", graphRead)).toBe(true);
    expect(workspaceRoleHasCapability("member", graphUpdate)).toBe(false);
  });
});
