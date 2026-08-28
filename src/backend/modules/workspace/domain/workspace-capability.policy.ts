import type { WorkspaceCapability } from "./workspace-access.service";

const fullCapabilities = new Set<WorkspaceCapability>([
  "story:read",
  "story:create",
  "story:update",
  "story:delete",
  "graph:read",
  "graph:update",
]);

const memberReadCapabilities = new Set<WorkspaceCapability>(["story:read", "graph:read"]);

export function workspaceRoleHasCapability(
  roleValue: string,
  capability: WorkspaceCapability,
): boolean {
  const roles = roleValue
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (roles.some((role) => role === "owner" || role === "admin")) {
    return fullCapabilities.has(capability);
  }

  return roles.includes("member") && memberReadCapabilities.has(capability);
}
