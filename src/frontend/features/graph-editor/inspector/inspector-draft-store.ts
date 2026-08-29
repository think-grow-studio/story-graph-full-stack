import { createStore, type StoreApi } from "zustand/vanilla";

import {
  createInspectorDraftFromEntity,
  type InspectorCanonicalEntity,
  type InspectorDraft,
  type InspectorDraftPatch,
  type InspectorEntityKey,
} from "./inspector-draft-model";

export type InspectorDraftState = {
  drafts: Readonly<Partial<Record<InspectorEntityKey, InspectorDraft>>>;
  ensureDraft: (
    key: InspectorEntityKey,
    entity: InspectorCanonicalEntity,
  ) => void;
  updateDraft: (key: InspectorEntityKey, patch: InspectorDraftPatch) => void;
};

export type InspectorDraftStore = StoreApi<InspectorDraftState>;

export function createInspectorDraftStore(): InspectorDraftStore {
  return createStore<InspectorDraftState>()((set, get) => ({
    drafts: {},
    ensureDraft: (key, entity) => {
      if (get().drafts[key]) return;
      set((state) => ({
        drafts: {
          ...state.drafts,
          [key]: createInspectorDraftFromEntity(entity),
        },
      }));
    },
    updateDraft: (key, patch) => {
      const current = get().drafts[key];
      if (!current) return;

      const next = { ...current, ...patch };
      if (
        next.name === current.name &&
        next.description === current.description &&
        next.propertiesText === current.propertiesText
      ) {
        return;
      }

      set((state) => ({
        drafts: {
          ...state.drafts,
          [key]: {
            ...next,
            revision: current.revision + 1,
          },
        },
      }));
    },
  }));
}
