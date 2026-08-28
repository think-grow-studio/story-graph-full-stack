import type { GraphNode } from "./graph-node";

export type GraphNodeUpdateResult =
  | { kind: "updated"; node: GraphNode }
  | { kind: "conflict" }
  | { kind: "not-found" };

export interface GraphRepository {
  createNode(node: GraphNode): Promise<GraphNode>;
  findNodeById(id: string): Promise<GraphNode | null>;
  listNodesByStory(storyId: string): Promise<GraphNode[]>;
  updateNode(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: Record<string, unknown>;
  }): Promise<GraphNodeUpdateResult>;
  deleteNode(id: string): Promise<boolean>;
}
