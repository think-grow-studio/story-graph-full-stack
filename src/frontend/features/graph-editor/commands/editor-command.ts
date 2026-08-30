import type {
  CreateEdgeCommand,
  RemoveBoardEdgeCommand,
  RestoreBoardEdgeCommand,
  UpdateEdgeCommand,
} from "./edge-commands";
import type {
  CreateNodeCommand,
  MoveNodeCommand,
  PlaceBoardNodeCommand,
  RemoveBoardNodeCommand,
  RestoreBoardNodeCommand,
  UpdateNodeCommand,
} from "./node-commands";

export type EditorCommand =
  | CreateNodeCommand
  | PlaceBoardNodeCommand
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
  PlaceBoardNodeCommand,
  RemoveBoardEdgeCommand,
  RemoveBoardNodeCommand,
  RestoreBoardEdgeCommand,
  RestoreBoardNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
};
