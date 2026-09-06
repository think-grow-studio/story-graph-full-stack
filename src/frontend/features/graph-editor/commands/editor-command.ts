import type {
  CreateEdgeCommand,
  DeleteEdgeCommand,
  RestoreEdgeCommand,
  UpdateEdgeCommand,
} from "./edge-commands";
import type {
  CreateNodeCommand,
  DeleteNodeCommand,
  MoveNodeCommand,
  RestoreNodeCommand,
  UpdateNodeCommand,
} from "./node-commands";

export type EditorCommand =
  | CreateNodeCommand
  | MoveNodeCommand
  | UpdateNodeCommand
  | DeleteNodeCommand
  | RestoreNodeCommand
  | CreateEdgeCommand
  | UpdateEdgeCommand
  | DeleteEdgeCommand
  | RestoreEdgeCommand;

export type {
  CreateEdgeCommand,
  CreateNodeCommand,
  DeleteEdgeCommand,
  DeleteNodeCommand,
  MoveNodeCommand,
  RestoreEdgeCommand,
  RestoreNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
};
