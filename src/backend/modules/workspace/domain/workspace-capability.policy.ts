import type { WorkspaceCapability } from "./workspace-access.service";

const fullStoryCapabilities = new Set<WorkspaceCapability>([
  "story:read",
  "story:create",
  "story:update",
  "story:delete",
]);

export function workspaceRoleHasCapability(
  roleValue: string,
  capability: WorkspaceCapability,
): boolean {
  const roles = roleValue
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (roles.some((role) => role === "owner" || role === "admin")) {
    return fullStoryCapabilities.has(capability);
  }

  return roles.includes("member") && capability === "story:read";
}
