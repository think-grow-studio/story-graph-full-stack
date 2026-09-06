import type {
  GraphEdgeResponse,
  GraphNodeResponse,
  RestoreNodeResponse,
} from "@/contracts/graph/graph.contract";

import type {
  CreateEdgeCommand,
  CreateNodeCommand,
  DeleteEdgeCommand,
  DeleteNodeCommand,
  MoveNodeCommand,
  RestoreEdgeCommand,
  RestoreNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
} from "../commands/editor-command";

export type EditorPersistence = {
  createNode: (command: CreateNodeCommand) => Promise<GraphNodeResponse>;
  moveNode: (command: MoveNodeCommand) => Promise<GraphNodeResponse>;
  updateNode: (command: UpdateNodeCommand) => Promise<GraphNodeResponse>;
  deleteNode: (command: DeleteNodeCommand) => Promise<void>;
  restoreNode: (command: RestoreNodeCommand) => Promise<RestoreNodeResponse>;
  createEdge: (command: CreateEdgeCommand) => Promise<GraphEdgeResponse>;
  updateEdge: (command: UpdateEdgeCommand) => Promise<GraphEdgeResponse>;
  deleteEdge: (command: DeleteEdgeCommand) => Promise<void>;
  restoreEdge: (command: RestoreEdgeCommand) => Promise<GraphEdgeResponse>;
};
