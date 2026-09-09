import { createStore, type StoreApi } from "zustand/vanilla";

import {
  areInspectorDraftValuesEqual,
  createInspectorDraftFromEntity,
  type InspectorCanonicalEntity,
  type InspectorDraft,
  type InspectorDraftPatch,
  type InspectorEntityKey,
} from "./inspector-draft-model";

type InspectorDraftReplacement =
  | Pick<
      InspectorDraft,
      | "name"
      | "description"
      | "kind"
      | "properties"
      | "direction"
      | "routingType"
    >
  | InspectorCanonicalEntity;

export type InspectorDraftState = {
  drafts: Readonly<Partial<Record<InspectorEntityKey, InspectorDraft>>>;
  ensureDraft: (
    key: InspectorEntityKey,
    entity: InspectorCanonicalEntity,
  ) => void;
  updateDraft: (key: InspectorEntityKey, patch: InspectorDraftPatch) => void;
  replaceDraft: (
    key: InspectorEntityKey,
    input: InspectorDraftReplacement,
  ) => void;
  discardDraft: (key: InspectorEntityKey) => void;
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
      if (areInspectorDraftValuesEqual(next, current)) return;

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
    replaceDraft: (key, input) => {
      const current = get().drafts[key];
      if (!current) return;

      const next = toDraftReplacement(input, current.revision);
      if (areInspectorDraftValuesEqual(next, current)) return;

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
    discardDraft: (key) => {
      if (!get().drafts[key]) return;
      set((state) => {
        const nextDrafts = { ...state.drafts };
        delete nextDrafts[key];
        return { drafts: nextDrafts };
      });
    },
  }));
}

function toDraftReplacement(
  input: InspectorDraftReplacement,
  revision: number,
): InspectorDraft {
  if ("direction" in input && "routingType" in input) {
    return { ...input, revision };
  }

  return {
    ...createInspectorDraftFromEntity(input as InspectorCanonicalEntity),
    revision,
  };
}
