export type Category = {
  id: string;
  name: string;
  description?: string;
  order: number;
};

export type Participant = {
  id: string;
  bib: number;
  name: string;
  categoryId?: string;
  team?: string;
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

export type Race = {
  id: string;
  name: string;
  totalLaps: number;
  createdAt: number;
  updatedAt: number;
  categories: Category[];
  participants: Participant[];
};

export type RaceStatePayload = {
  race: {
    id: string;
    name: string;
    totalLaps: number;
  } | null;
  categories: Category[];
  riders: Rider[];
  tapEvents: TapEvent[];
};

export type RaceBroadcastEvent =
  | {
      type: "tap-recorded";
      payload: TapEvent;
    }
  | {
      type: "tap-cancelled";
      payload: { eventId: string };
    }
  | {
      type: "race-updated";
      payload: RaceStatePayload;
    };
