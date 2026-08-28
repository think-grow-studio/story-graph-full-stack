"use client";

import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createGraphEditorStore,
  type GraphEditorStore,
} from "./graph-editor-store";
import type { GraphEditorState } from "../model/editor-types";

const GraphEditorStoreContext = createContext<GraphEditorStore | null>(null);

export function GraphEditorStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<GraphEditorStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createGraphEditorStore();
  }

  return (
    <GraphEditorStoreContext.Provider value={storeRef.current}>
      {children}
    </GraphEditorStoreContext.Provider>
  );
}

export function useGraphEditorStoreApi() {
  const store = useContext(GraphEditorStoreContext);
  if (!store) {
    throw new Error("GraphEditorStoreProvider is required");
  }
  return store;
}

export function useGraphEditorStore<T>(
  selector: (state: GraphEditorState) => T,
): T {
  const store = useGraphEditorStoreApi();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
