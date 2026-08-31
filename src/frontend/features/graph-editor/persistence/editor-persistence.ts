import type {
  BoardNodeResponse,
  EdgeStateResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
  NodeStateResponse,
  RestoreBoardNodeResponse,
} from "@/contracts/graph/graph.contract";

import type {
  CreateEdgeCommand,
  CreateNodeCommand,
  MoveNodeCommand,
  PlaceBoardNodeCommand,
  RemoveBoardEdgeCommand,
  RemoveBoardNodeCommand,
  RestoreBoardEdgeCommand,
  RestoreBoardNodeCommand,
  UpdateEdgeCommand,
  UpdateEdgeStateCommand,
  UpdateNodeCommand,
  UpdateNodeStateCommand,
} from "../commands/editor-command";
import type {
  GraphEditorEdgePair,
  GraphEditorNodePair,
} from "../model/editor-types";

export type EditorPersistence = {
  createNode: (command: CreateNodeCommand) => Promise<GraphEditorNodePair>;
  placeBoardNode: (command: PlaceBoardNodeCommand) => Promise<GraphEditorNodePair>;
  moveNode: (command: MoveNodeCommand) => Promise<BoardNodeResponse>;
  createEdge: (command: CreateEdgeCommand) => Promise<GraphEditorEdgePair>;
  updateNode: (command: UpdateNodeCommand) => Promise<GraphNodeResponse>;
  updateNodeState: (command: UpdateNodeStateCommand) => Promise<NodeStateResponse>;
  updateEdge: (command: UpdateEdgeCommand) => Promise<GraphEdgeResponse>;
  updateEdgeState: (command: UpdateEdgeStateCommand) => Promise<EdgeStateResponse>;
  removeBoardNode: (command: RemoveBoardNodeCommand) => Promise<void>;
  restoreBoardNode: (
    command: RestoreBoardNodeCommand,
  ) => Promise<RestoreBoardNodeResponse>;
  removeBoardEdge: (command: RemoveBoardEdgeCommand) => Promise<void>;
  restoreBoardEdge: (command: RestoreBoardEdgeCommand) => Promise<GraphEditorEdgePair>;
};
