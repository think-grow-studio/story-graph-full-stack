import type {
  WorkspaceAccessService,
  WorkspaceSummary,
} from "../../domain/workspace-access.service";

export interface WorkspaceProvisioner {
  createPersonalWorkspace(input: {
    userId: string;
    name: string;
    slug: string;
  }): Promise<WorkspaceSummary>;
}

export function personalWorkspaceSlug(userId: string): string {
  const normalized = userId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `personal-${normalized}`;
}

export async function ensurePersonalWorkspace(
  input: { userId: string; userName: string },
  dependencies: {
    access: WorkspaceAccessService;
    provisioner: WorkspaceProvisioner;
  },
): Promise<WorkspaceSummary> {
  const existing = await dependencies.access.findPersonalWorkspace(input.userId);
  if (existing) {
    return existing;
  }

  const slug = personalWorkspaceSlug(input.userId);
  const trimmedName = input.userName.trim();
  const name = trimmedName ? `${trimmedName}'s Workspace` : "Personal Workspace";

  try {
    return await dependencies.provisioner.createPersonalWorkspace({
      userId: input.userId,
      name,
      slug,
    });
  } catch (error) {
    const recovered = await dependencies.access.findPersonalWorkspace(input.userId);
    if (recovered) {
      return recovered;
    }
    throw error;
  }
}
