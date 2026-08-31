import type {
  CreateEdgeCommand,
  RemoveBoardEdgeCommand,
  RestoreBoardEdgeCommand,
  UpdateEdgeCommand,
  UpdateEdgeStateCommand,
} from "./edge-commands";
import type {
  CreateNodeCommand,
  MoveNodeCommand,
  PlaceBoardNodeCommand,
  RemoveBoardNodeCommand,
  RestoreBoardNodeCommand,
  UpdateNodeCommand,
  UpdateNodeStateCommand,
} from "./node-commands";

export type EditorCommand =
  | CreateNodeCommand
  | PlaceBoardNodeCommand
  | MoveNodeCommand
  | CreateEdgeCommand
  | UpdateNodeCommand
  | UpdateNodeStateCommand
  | UpdateEdgeCommand
  | UpdateEdgeStateCommand
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
  UpdateEdgeStateCommand,
  UpdateNodeCommand,
  UpdateNodeStateCommand,
};
