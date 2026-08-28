import type {
  GraphEditorNodePair,
  GraphEditorState,
} from "../model/editor-types";

type Listener = () => void;

export type GraphEditorStore = {
  getState: () => GraphEditorState;
  subscribe: (listener: Listener) => () => void;
};

export function createGraphEditorStore(): GraphEditorStore {
  const listeners = new Set<Listener>();
  let state: GraphEditorState;

  const publish = (next: GraphEditorState) => {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  };

  const upsertNodePair = (
    input: GraphEditorNodePair,
  ): Pick<GraphEditorState, "nodes" | "boardNodes"> => ({
    nodes: [
      ...state.nodes.filter((node) => node.id !== input.node.id),
      input.node,
    ],
    boardNodes: [
      ...state.boardNodes.filter(
        (boardNode) => boardNode.nodeId !== input.boardNode.nodeId,
      ),
      input.boardNode,
    ],
  });

  const hydrate: GraphEditorState["hydrate"] = (snapshot) => {
    publish({
      ...state,
      nodes: [...snapshot.nodes],
      edges: [...snapshot.edges],
      boardNodes: [...snapshot.boardNodes],
      boardEdges: [...snapshot.boardEdges],
    });
  };

  const addOptimisticNode: GraphEditorState["addOptimisticNode"] = (input) => {
    publish({ ...state, ...upsertNodePair(input) });
  };

  const reconcileNode: GraphEditorState["reconcileNode"] = (input) => {
    publish({ ...state, ...upsertNodePair(input) });
  };

  const removeNode: GraphEditorState["removeNode"] = (nodeId) => {
    publish({
      ...state,
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      boardNodes: state.boardNodes.filter(
        (boardNode) => boardNode.nodeId !== nodeId,
      ),
    });
  };

  const setNodePosition: GraphEditorState["setNodePosition"] = (nodeId, position) => {
    publish({
      ...state,
      boardNodes: state.boardNodes.map((boardNode) =>
        boardNode.nodeId === nodeId
          ? { ...boardNode, x: position.x, y: position.y }
          : boardNode,
      ),
    });
  };

  const replaceBoardNode: GraphEditorState["replaceBoardNode"] = (boardNode) => {
    publish({
      ...state,
      boardNodes: [
        ...state.boardNodes.filter(
          (current) => current.nodeId !== boardNode.nodeId,
        ),
        boardNode,
      ],
    });
  };

  state = {
    nodes: [],
    edges: [],
    boardNodes: [],
    boardEdges: [],
    hydrate,
    addOptimisticNode,
    reconcileNode,
    removeNode,
    setNodePosition,
    replaceBoardNode,
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
