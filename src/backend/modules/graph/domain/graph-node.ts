export interface GraphNode {
  id: string;
  storyId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
