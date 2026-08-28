import type { GraphEditorState } from "../model/editor-types";

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

  const hydrate: GraphEditorState["hydrate"] = (snapshot) => {
    publish({
      ...state,
      nodes: [...snapshot.nodes],
      edges: [...snapshot.edges],
      boardNodes: [...snapshot.boardNodes],
      boardEdges: [...snapshot.boardEdges],
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

  state = {
    nodes: [],
    edges: [],
    boardNodes: [],
    boardEdges: [],
    hydrate,
    setNodePosition,
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
