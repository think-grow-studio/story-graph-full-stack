import { createStore, type StoreApi } from "zustand/vanilla";

import {
  createInspectorDraftFromEntity,
  type InspectorCanonicalEntity,
  type InspectorDraft,
  type InspectorDraftPatch,
  type InspectorEntityKey,
} from "./inspector-draft-model";

type InspectorDraftReplacement =
  | Pick<InspectorDraft, "name" | "description" | "propertiesText">
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
    replaceDraft: (key, input) => {
      const current = get().drafts[key];
      if (!current) return;

      const next = toDraftReplacement(input);
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

function toDraftReplacement(
  input: InspectorDraftReplacement,
): Pick<InspectorDraft, "name" | "description" | "propertiesText"> {
  if ("propertiesText" in input) return input;

  const draft = createInspectorDraftFromEntity(input);
  return {
    name: draft.name,
    description: draft.description,
    propertiesText: draft.propertiesText,
  };
}
