import { create } from "zustand";

export type Category = {
  id: string;
  name: string;
  description?: string;
  order: number;
};

export type RaceSummary = {
  id: string;
  name: string;
  totalLaps: number;
  startedAt: number | null;
};

export type Rider = {
  bib: number;
  name: string;
  category: string;
  categoryId?: string;
};

export type TapEvent = {
  id: string;
  bib: number;
  name: string;
  category: string;
  categoryId?: string;
  timestamp: number;
  source: "manual" | "system";
};

export type RaceStatePayload = {
  race: RaceSummary | null;
  categories: Category[];
  riders: Rider[];
  tapEvents: TapEvent[];
};

function sortTapEvents(events: TapEvent[]): TapEvent[] {
  return [...events].sort((a, b) => b.timestamp - a.timestamp);
}

type RaceStore = {
  race: RaceSummary | null;
  categories: Category[];
  riders: Rider[];
  tapEvents: TapEvent[];
  isHydrated: boolean;
  isConnected: boolean;
  error?: string;
  currentRaceId?: string;
  setInitialState: (payload: RaceStatePayload) => void;
  upsertTapEvent: (event: TapEvent) => void;
  removeTapEvent: (eventId: string) => void;
  setConnectionStatus: (connected: boolean) => void;
  setError: (message?: string) => void;
  setCurrentRace: (raceId?: string) => void;
};

export const useRaceStore = create<RaceStore>((set) => ({
  race: null,
  categories: [],
  riders: [],
  tapEvents: [],
  isHydrated: false,
  isConnected: false,
  error: undefined,
  currentRaceId: undefined,
  setInitialState: ({ race, categories, riders, tapEvents }) => {
    set({
      race,
      categories,
      riders,
      tapEvents: sortTapEvents(tapEvents),
      isHydrated: true,
    });
  },
  upsertTapEvent: (event) => {
    set((state) => {
      if (state.tapEvents.some((existing) => existing.id === event.id)) {
        return state;
      }

      const next = sortTapEvents([event, ...state.tapEvents]);
      return { tapEvents: next };
    });
  },
  removeTapEvent: (eventId) => {
    set((state) => ({
      tapEvents: state.tapEvents.filter((event) => event.id !== eventId),
    }));
  },
  setConnectionStatus: (connected) => set({ isConnected: connected }),
  setError: (message) => set({ error: message }),
  setCurrentRace: (raceId) => set({ currentRaceId: raceId }),
}));
