import type {
  CreateEdgeCommand,
  RemoveBoardEdgeCommand,
  UpdateEdgeCommand,
} from "./edge-commands";
import type {
  CreateNodeCommand,
  MoveNodeCommand,
  RemoveBoardNodeCommand,
  UpdateNodeCommand,
} from "./node-commands";

export type EditorCommand =
  | CreateNodeCommand
  | MoveNodeCommand
  | CreateEdgeCommand
  | UpdateNodeCommand
  | UpdateEdgeCommand
  | RemoveBoardNodeCommand
  | RemoveBoardEdgeCommand;

export type {
  CreateEdgeCommand,
  CreateNodeCommand,
  MoveNodeCommand,
  RemoveBoardEdgeCommand,
  RemoveBoardNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
};
