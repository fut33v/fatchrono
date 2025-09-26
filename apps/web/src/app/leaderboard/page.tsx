"use client";

import { useEffect, useMemo, useState } from "react";
import { useRaceStore } from "@/store/race-store";

export default function LeaderboardPage() {
  const race = useRaceStore((state) => state.race);
  const tapEvents = useRaceStore((state) => state.tapEvents);
  const riders = useRaceStore((state) => state.riders);
  const error = useRaceStore((state) => state.error);
  const isConnected = useRaceStore((state) => state.isConnected);
  const isHydrated = useRaceStore((state) => state.isHydrated);

  const [localTime, setLocalTime] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLocalTime(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const leader = useMemo(() => {
    if (!race) {
      return null;
    }

    const lapCounts = new Map<number, number>();
    for (const tap of tapEvents) {
      lapCounts.set(tap.bib, (lapCounts.get(tap.bib) ?? 0) + 1);
    }

    let bestBib: number | null = null;
    let bestLaps = -1;
    let lastTapTime = 0;

    for (const rider of riders) {
      const laps = lapCounts.get(rider.bib) ?? 0;
      if (laps > bestLaps) {
        bestBib = rider.bib;
        bestLaps = laps;
        lastTapTime = tapEvents.find((event) => event.bib === rider.bib)?.timestamp ?? 0;
      }
    }

    if (bestBib === null) {
      return null;
    }

    const rider = riders.find((item) => item.bib === bestBib);
    const lapsRemaining = Math.max(race.totalLaps - bestLaps, 0);

    return {
      bib: bestBib,
      name: rider?.name ?? `Гонщик #${bestBib}`,
      lapsCompleted: bestLaps,
      lapsRemaining,
      lastTapTime,
    };
  }, [race, tapEvents, riders]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-black text-white">
      <div className="w-full max-w-4xl space-y-10 px-6 py-16 text-center">
        <header className="space-y-3">
          <h1 className="text-4xl font-semibold uppercase tracking-[0.3rem] text-white">
            {race?.name ?? "Гонка не выбрана"}
          </h1>
          <p className="text-sm uppercase tracking-[0.3rem] text-zinc-400">
            {localTime.toLocaleTimeString()}
          </p>
          {!isConnected && (
            <div className="rounded-full border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-xs uppercase tracking-wide text-amber-200">
              Нет подключения к серверу — смотрим сохранённые данные
            </div>
          )}
          {error && (
            <div className="rounded-full border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-xs uppercase tracking-wide text-rose-200">
              {error}
            </div>
          )}
        </header>

        {!isHydrated && (
          <div className="text-lg text-zinc-300">
            Загружаем данные гонки…
          </div>
        )}

        {isHydrated && leader && (
          <section className="space-y-12">
            <div className="space-y-4">
              <div className="text-sm uppercase tracking-[0.6rem] text-zinc-400">
                Лидер гонки
              </div>
              <div className="text-6xl font-semibold text-white">
                #{leader.bib} · {leader.name}
              </div>
            </div>

            <div className="space-y-6">
              <div className="text-sm uppercase tracking-[0.4rem] text-zinc-400">
                Осталось кругов
              </div>
              <div className="text-[14rem] font-bold leading-none text-teal-300">
                {leader.lapsRemaining}
              </div>
              <div className="text-sm text-zinc-500">
                Пройдено кругов: {leader.lapsCompleted} из {race?.totalLaps ?? 0}
              </div>
            </div>
          </section>
        )}

        {isHydrated && !leader && (
          <div className="text-lg text-zinc-300">
            Лидер ещё не определён — отметок пока нет.
          </div>
        )}
      </div>
    </div>
  );
}
