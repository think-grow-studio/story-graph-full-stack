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
  RestoreBoardNodeCommand,
  UpdateNodeCommand,
} from "./node-commands";

export type EditorCommand =
  | CreateNodeCommand
  | MoveNodeCommand
  | CreateEdgeCommand
  | UpdateNodeCommand
  | UpdateEdgeCommand
  | RemoveBoardNodeCommand
  | RestoreBoardNodeCommand
  | RemoveBoardEdgeCommand
  | RestoreBoardEdgeCommand;

export type {
  CreateEdgeCommand,
  CreateNodeCommand,
  MoveNodeCommand,
  RemoveBoardEdgeCommand,
  RemoveBoardNodeCommand,
  RestoreBoardEdgeCommand,
  RestoreBoardNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
};
