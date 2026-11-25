import { create } from "zustand";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import type {
  ItinerarySearchResult,
  ItineraryDetail,
} from "../types/experimentalItinerary.types";

type Selection = {
  businessId: number;
  generation: number;
  search: ItinerarySearchResult;
  token: string;
  destinationName: string;
  detail?: ItineraryDetail;
};
/** Hold a single signed selection in session memory, never in URLs or persistent storage. */
export const useItinerarySelectionStore = create<{
  selected: Selection | null;
  refresh: number;
  restart: () => void;
  select: (value: Omit<Selection, "generation">) => void;
  hydrate: (token: string, detail: ItineraryDetail) => void;
}>((set) => ({
  selected: null,
  refresh: 0,
  restart: () => set((s) => ({ selected: null, refresh: s.refresh + 1 })),
  select: (value) =>
    set({ selected: { ...value, generation: getAuthSessionGeneration() } }),
  hydrate: (token, detail) =>
    set((state) => ({
      selected:
        state.selected?.token === token &&
        state.selected.generation === getAuthSessionGeneration()
          ? { ...state.selected, detail }
          : state.selected,
    })),
}));
