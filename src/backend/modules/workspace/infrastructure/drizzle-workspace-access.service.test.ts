import { describe, expect, it } from "vitest";

import { workspaceRoleHasCapability } from "../domain/workspace-capability.policy";

describe("workspaceRoleHasCapability", () => {
  it("maps Better Auth roles to Story capabilities", () => {
    expect(workspaceRoleHasCapability("owner", "story:delete")).toBe(true);
    expect(workspaceRoleHasCapability("admin", "story:update")).toBe(true);
    expect(workspaceRoleHasCapability("member", "story:read")).toBe(true);
    expect(workspaceRoleHasCapability("member", "story:update")).toBe(false);
    expect(workspaceRoleHasCapability("member,admin", "story:delete")).toBe(true);
  });

  it("maps Better Auth roles to graph capabilities", () => {
    expect(workspaceRoleHasCapability("owner", "graph:read")).toBe(true);
    expect(workspaceRoleHasCapability("admin", "graph:update")).toBe(true);
    expect(workspaceRoleHasCapability("member", "graph:read")).toBe(true);
    expect(workspaceRoleHasCapability("member", "graph:update")).toBe(false);
    expect(workspaceRoleHasCapability("member,admin", "graph:update")).toBe(true);
  });
});
