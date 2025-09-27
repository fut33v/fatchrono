"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRaceStore } from "@/store/race-store";

export function RacePathWatcher() {
  const pathname = usePathname();
  const setCurrentRace = useRaceStore((state) => state.setCurrentRace);

  useEffect(() => {
    const match = pathname.match(/\/(?:results|chrono|leaderboard)\/([^/]+)/);
    if (match && match[1]) {
      try {
        setCurrentRace(decodeURIComponent(match[1]));
      } catch {
        setCurrentRace(match[1]);
      }
      return;
    }
    setCurrentRace(undefined);
  }, [pathname, setCurrentRace]);

  return null;
}
