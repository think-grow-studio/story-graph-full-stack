export type WorkspaceCapability =
  | "story:read"
  | "story:create"
  | "story:update"
  | "story:delete";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

export interface WorkspaceAccessService {
  findPersonalWorkspace(userId: string): Promise<WorkspaceSummary | null>;
  requireCapability(input: {
    userId: string;
    workspaceId: string;
    capability: WorkspaceCapability;
  }): Promise<void>;
}
