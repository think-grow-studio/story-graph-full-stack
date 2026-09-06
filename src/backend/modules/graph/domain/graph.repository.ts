import type {
  Board,
  BoardSnapshot,
  CreateGraphEdge,
  CreateGraphNode,
  DeletedNodeSnapshot,
  GraphEdge,
  GraphNode,
  JsonObject,
  RestorableGraphEdge,
  RestorableGraphNode,
} from "./graph";

export interface GraphRepository {
  createBoard(input: {
    storyId: string;
    name: string;
    description: string;
    tags: string[];
  }): Promise<Board>;
  updateBoard(input: {
    id: string;
    name?: string;
    description?: string;
    tags?: string[];
  }): Promise<Board | null>;
  listBoards(storyId: string): Promise<Board[]>;
  findBoard(id: string): Promise<Board | null>;
  getBoardSnapshot(boardId: string): Promise<BoardSnapshot | null>;

  createNode(input: CreateGraphNode): Promise<GraphNode>;
  findNode(boardId: string, nodeId: string): Promise<GraphNode | null>;
  updateNode(input: {
    boardId: string;
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    style?: JsonObject;
  }): Promise<GraphNode | null>;
  deleteNode(boardId: string, nodeId: string): Promise<DeletedNodeSnapshot | null>;
  restoreNode(input: {
    boardId: string;
    node: RestorableGraphNode;
    edges: RestorableGraphEdge[];
  }): Promise<{ node: GraphNode; edges: GraphEdge[] } | null>;

  createEdge(input: CreateGraphEdge): Promise<GraphEdge>;
  findEdge(boardId: string, edgeId: string): Promise<GraphEdge | null>;
  updateEdge(input: {
    boardId: string;
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
    style?: JsonObject;
    labelPresentation?: JsonObject;
  }): Promise<GraphEdge | null>;
  deleteEdge(boardId: string, edgeId: string): Promise<GraphEdge | null>;
  restoreEdge(input: {
    boardId: string;
    edge: RestorableGraphEdge;
  }): Promise<GraphEdge | null>;
}
