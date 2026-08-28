import type {
  Board,
  BoardEdge,
  BoardNode,
  BoardSnapshot,
  GraphEdge,
  GraphNode,
  JsonObject,
} from "./graph";

export interface GraphRepository {
  createBoard(input: {
    storyId: string;
    name: string;
    description: string;
  }): Promise<Board>;
  listBoards(storyId: string): Promise<Board[]>;
  findBoard(id: string): Promise<Board | null>;
  findNode(id: string): Promise<GraphNode | null>;
  findEdge(id: string): Promise<GraphEdge | null>;
  getBoardSnapshot(boardId: string): Promise<BoardSnapshot | null>;
  createNodeOnBoard(input: {
    boardId: string;
    node: GraphNode;
    placement: Pick<
      BoardNode,
      "x" | "y" | "width" | "height" | "zIndex" | "style"
    >;
  }): Promise<{ node: GraphNode; boardNode: BoardNode }>;
  updateNode(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
  }): Promise<GraphNode | null>;
  updateBoardNode(input: {
    boardId: string;
    nodeId: string;
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    style?: JsonObject;
  }): Promise<BoardNode | null>;
  removeNodeFromBoard(boardId: string, nodeId: string): Promise<boolean>;
  createEdgeOnBoard(input: {
    boardId: string;
    edge: GraphEdge;
  }): Promise<{ edge: GraphEdge; boardEdge: BoardEdge }>;
  updateEdge(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
  }): Promise<GraphEdge | null>;
  removeEdgeFromBoard(boardId: string, edgeId: string): Promise<boolean>;
}
