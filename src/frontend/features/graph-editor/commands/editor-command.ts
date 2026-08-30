import type {
  CreateEdgeCommand,
  RemoveBoardEdgeCommand,
  RestoreBoardEdgeCommand,
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
  | RemoveBoardEdgeCommand
  | RestoreBoardEdgeCommand;

export type {
  CreateEdgeCommand,
  CreateNodeCommand,
  MoveNodeCommand,
  RemoveBoardEdgeCommand,
  RemoveBoardNodeCommand,
  RestoreBoardEdgeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
};
