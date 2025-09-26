"use client";

import { useEffect, useMemo, useState } from "react";
import { useRaceStore } from "@/store/race-store";

export default function LeaderboardPage() {
  const race = useRaceStore((state) => state.race);
  const tapEvents = useRaceStore((state) => state.tapEvents);
  const riders = useRaceStore((state) => state.riders);
  const currentRaceId = useRaceStore((state) => state.currentRaceId);
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

    for (const rider of riders) {
      const laps = lapCounts.get(rider.bib) ?? 0;
      if (laps > bestLaps) {
        bestBib = rider.bib;
        bestLaps = laps;
      }
    }

    if (bestBib === null) {
      return null;
    }

    const rider = riders.find((item) => item.bib === bestBib);
    const lapsRemaining = Math.max(race.totalLaps - (lapCounts.get(bestBib) ?? 0), 0);

    return {
      bib: bestBib,
      name: rider?.name ?? `Гонщик #${bestBib}`,
      lapsCompleted: lapCounts.get(bestBib) ?? 0,
      lapsRemaining,
    };
  }, [race, tapEvents, riders]);

  if (!currentRaceId) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-black px-4 text-sm text-zinc-300">
        <div className="max-w-md space-y-3 text-center">
          <p>Ссылка на табло лидера должна содержать идентификатор гонки: `/leaderboard/&lt;id&gt;`.</p>
          <p>Откройте ссылку из админки или пригласительного сообщения.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-black text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-4 py-10 text-center">
        {!isHydrated && (
          <div className="text-lg text-zinc-300">Загружаем данные гонки…</div>
        )}

        {isHydrated && leader && (
          <div className="flex w-full flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-6">
              <span className="text-sm uppercase tracking-[0.4rem] text-zinc-400">Осталось кругов</span>
              <div className="flex h-[min(60vh,60vw)] w-[min(60vh,60vw)] items-center justify-center">
                <div className="flex h-full w-full items-center justify-center rounded-[3rem] bg-gradient-to-b from-teal-500/30 via-teal-500/15 to-transparent text-[clamp(6rem,18vw,22rem)] font-bold leading-none text-teal-200 shadow-inner">
                  {leader.lapsRemaining}
                </div>
              </div>
              <span className="text-sm text-zinc-500">
                Пройдено кругов: {leader.lapsCompleted} из {race?.totalLaps ?? 0}
              </span>
            </div>

            <div className="space-y-4">
              <div className="text-sm uppercase tracking-[0.6rem] text-zinc-400">Лидер гонки</div>
              <div className="break-words text-6xl font-semibold text-white">
                #{leader.bib} · {leader.name}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3rem] text-zinc-400">{localTime.toLocaleTimeString()}</p>
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
            </div>
          </div>
        )}

        {isHydrated && !leader && (
          <div className="flex flex-col items-center gap-4 text-zinc-300">
            <p className="text-lg">Лидер ещё не определён — отметок пока нет.</p>
            <p className="text-sm uppercase tracking-[0.3rem] text-zinc-500">{localTime.toLocaleTimeString()}</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
