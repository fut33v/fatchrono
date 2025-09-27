"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRaceStore } from "@/store/race-store";

export function useRaceIdFromPath() {
  const pathname = usePathname();
  const setCurrentRace = useRaceStore((state) => state.setCurrentRace);

  useEffect(() => {
    const pattern = /\/(results|chrono|leaderboard)\/(.+)$/;
    const match = pathname.match(pattern);
    if (match) {
      const value = match[2];
      try {
        setCurrentRace(decodeURIComponent(value));
      } catch {
        setCurrentRace(value);
      }
      return;
    }

    setCurrentRace(undefined);
  }, [pathname, setCurrentRace]);
}
