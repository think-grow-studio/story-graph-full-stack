import type {
  Board,
  BoardSnapshot,
  CreateGraphEdge,
  CreateGraphNode,
  DeletedNodeSnapshot,
  EdgeDirection,
  EdgePresentation,
  EdgeRouting,
  GraphEdge,
  GraphNode,
  GraphProperties,
  GraphSettings,
  NodePresentation,
  RestorableGraphEdge,
  RestorableGraphNode,
} from "./graph";

export interface GraphRepository {
  createBoard(input: {
    storyId: string;
    name: string;
    description: string;
    tags: string[];
    graphSettings: GraphSettings;
  }): Promise<Board>;
  updateBoard(input: {
    id: string;
    name?: string;
    description?: string;
    tags?: string[];
    graphSettings?: GraphSettings;
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
    kind?: string;
    iconKey?: string | null;
    properties?: GraphProperties;
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    presentation?: NodePresentation;
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
    direction?: EdgeDirection;
    name?: string;
    description?: string;
    kind?: string;
    iconKey?: string | null;
    properties?: GraphProperties;
    presentation?: EdgePresentation;
    routing?: EdgeRouting;
  }): Promise<GraphEdge | null>;
  deleteEdge(boardId: string, edgeId: string): Promise<GraphEdge | null>;
  restoreEdge(input: {
    boardId: string;
    edge: RestorableGraphEdge;
  }): Promise<GraphEdge | null>;
}
