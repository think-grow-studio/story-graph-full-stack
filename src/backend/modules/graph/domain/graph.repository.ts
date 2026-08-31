import type {
  Board,
  BoardEdge,
  BoardNode,
  BoardSnapshot,
  GraphEdge,
  GraphNode,
  JsonObject,
  NodeState,
  Scope,
} from "./graph";

export interface GraphRepository {
  createScope(input: {
    storyId: string;
    name: string;
    description: string;
  }): Promise<Scope>;
  listScopes(storyId: string): Promise<Scope[]>;
  findScope(id: string): Promise<Scope | null>;
  createBoard(input: {
    storyId: string;
    scopeId?: string | null;
    name: string;
    description: string;
  }): Promise<Board>;
  listBoards(storyId: string): Promise<Board[]>;
  findBoard(id: string): Promise<Board | null>;
  listNodes(storyId: string): Promise<GraphNode[]>;
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
  placeNodeOnBoard(input: {
    boardId: string;
    nodeId: string;
    placement: Pick<
      BoardNode,
      "x" | "y" | "width" | "height" | "zIndex" | "style"
    >;
  }): Promise<{ node: GraphNode; boardNode: BoardNode } | null>;
  putNodeState(input: {
    scopeId: string;
    nodeId: string;
    expectedVersion: number | null;
    name: string | null;
    description: string | null;
    properties: JsonObject | null;
  }): Promise<NodeState | "conflict" | null>;
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
  restoreNodeToBoard(input: {
    boardId: string;
    nodeId: string;
    placement: Pick<
      BoardNode,
      "x" | "y" | "width" | "height" | "zIndex" | "style"
    >;
    boardEdges: Array<
      Pick<BoardEdge, "edgeId" | "style" | "labelPresentation">
    >;
  }): Promise<{
    node: GraphNode;
    boardNode: BoardNode;
    edges: GraphEdge[];
    boardEdges: BoardEdge[];
  } | null>;
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
  restoreEdgeToBoard(input: {
    boardId: string;
    edgeId: string;
    style: JsonObject;
    labelPresentation: JsonObject;
  }): Promise<{ edge: GraphEdge; boardEdge: BoardEdge } | null>;
}
