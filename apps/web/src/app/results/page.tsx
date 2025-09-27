"use client";

import { useMemo } from "react";
import { useRaceStore } from "@/store/race-store";

type ResultRow = {
  position: number;
  bib: number;
  name: string;
  category: string;
  laps: number;
  lastTap: number | null;
  gap: string;
};

type PodiumGroup = {
  category: string;
  riders: ResultRow[];
};

function formatGap(
  leader: ResultRow | undefined,
  row: ResultRow,
): string {
  if (!leader || leader.laps === 0) {
    return "—";
  }

  const lapDelta = leader.laps - row.laps;
  if (lapDelta > 0) {
    const unit =
      lapDelta === 1 ? "круг" : lapDelta < 5 ? "круга" : "кругов";
    return `-${lapDelta} ${unit}`;
  }

  if (!leader.lastTap || !row.lastTap) {
    return "+0с";
  }

  const timeDelta = row.lastTap - leader.lastTap;
  if (timeDelta <= 0) {
    return "+0с";
  }

  const seconds = timeDelta / 1000;
  const formatted = seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2);
  return `+${formatted}с`;
}

function compareResults(a: ResultRow, b: ResultRow): number {
  if (b.laps !== a.laps) {
    return b.laps - a.laps;
  }

  if (a.lastTap === b.lastTap) {
    return a.bib - b.bib;
  }

  if (a.lastTap === null) {
    return 1;
  }

  if (b.lastTap === null) {
    return -1;
  }

  return a.lastTap - b.lastTap;
}

export default function ResultsPage() {
  const race = useRaceStore((state) => state.race);
  const currentRaceId = useRaceStore((state) => state.currentRaceId);
  const categories = useRaceStore((state) => state.categories);
  const riders = useRaceStore((state) => state.riders);
  const tapEvents = useRaceStore((state) => state.tapEvents);
  const isHydrated = useRaceStore((state) => state.isHydrated);
  const isConnected = useRaceStore((state) => state.isConnected);
  const error = useRaceStore((state) => state.error);

  const { rows, podium } = useMemo<{
    rows: ResultRow[];
    podium: PodiumGroup[];
  }>(() => {
    const lapCounts = new Map<
      number,
      { laps: number; lastTap: number | null }
    >();

    for (const tap of tapEvents) {
      const current = lapCounts.get(tap.bib) ?? { laps: 0, lastTap: null };
      const lastTap = current.lastTap
        ? Math.max(current.lastTap, tap.timestamp)
        : tap.timestamp;
      lapCounts.set(tap.bib, {
        laps: current.laps + 1,
        lastTap,
      });
    }

    const mapped = riders.map((rider) => {
      const entry = lapCounts.get(rider.bib);
      return {
        position: 0,
        bib: rider.bib,
        name: rider.name,
        category: rider.category,
        laps: entry?.laps ?? 0,
        lastTap: entry?.lastTap ?? null,
        gap: "—",
      } satisfies ResultRow;
    });

    mapped.sort(compareResults);

    const leader = mapped[0];
    const ranked = mapped.map((row, index) => ({
      ...row,
      position: index + 1,
      gap: formatGap(leader, row),
    }));

    const categoryOrder = categories.map((category) => category.name);
    const grouped = new Map<string, ResultRow[]>();

    for (const row of ranked) {
      const key = row.category || "Без категории";
      const bucket = grouped.get(key) ?? [];
      bucket.push(row);
      grouped.set(key, bucket);
    }

    const knownCategories = new Set(categoryOrder);
    const extraCategories = Array.from(grouped.keys()).filter(
      (name) => !knownCategories.has(name),
    );
    const orderedNames = [
      ...categoryOrder,
      ...extraCategories.sort((a, b) => a.localeCompare(b, "ru")),
    ];

    const podiumGroups: PodiumGroup[] = orderedNames
      .filter((name) => grouped.has(name))
      .map((name) => ({
        category: name,
        riders: grouped.get(name)!
          .slice()
          .sort(compareResults)
          .slice(0, 3),
      }))
      .filter((group) => group.riders.length > 0);

    return {
      rows: ranked,
      podium: podiumGroups,
    };
  }, [riders, tapEvents, categories]);

  const totalTapCount = tapEvents.length;
  const leader = rows[0];

  if (!currentRaceId) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="max-w-md space-y-3 text-center text-sm text-slate-400">
          <p>Ссылка на результаты должна содержать идентификатор гонки: `/results/&lt;id&gt;`.</p>
          <p>Скопируйте её из админки или воспользуйтесь ссылкой, которой поделился организатор.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <div className="text-sm uppercase tracking-wide text-slate-400">
            Живые результаты
          </div>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            {race?.name ?? "Гонка не выбрана"}
          </h1>
          <p className="text-sm text-slate-400">
            Таблица обновляется автоматически по мере поступления отметок и
            данных от оборудования. Информация хранится локально, поэтому можно
            переключаться между режимами без потери гонки.
          </p>
          {!isConnected && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              Нет соединения с сервером. Показаны последние сохранённые данные.
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}
          <div className="text-xs text-slate-500">
            {race ? `Кругов в гонке: ${race.totalLaps} • ` : ""}
            Всего отметок: {totalTapCount} • Кругов у лидера: {leader?.laps ?? 0}
          </div>
          {categories.length > 0 && (
            <div className="text-xs text-slate-500">
              Категории: {categories.map((category) => category.name).join(", ")}
            </div>
          )}
        </header>

        {!isHydrated && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
            Загружаем текущее состояние гонки…
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Место</th>
                <th className="px-4 py-3">Номер</th>
                <th className="px-4 py-3">Гонщик</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Круги</th>
                <th className="px-4 py-3">Отставание</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((racer) => (
                <tr
                  key={racer.bib}
                  className="border-t border-slate-800/70 text-slate-100"
                >
                  <td className="px-4 py-3 font-semibold">{racer.position}</td>
                  <td className="px-4 py-3 text-slate-300">#{racer.bib}</td>
                  <td className="px-4 py-3">{racer.name}</td>
                  <td className="px-4 py-3 text-slate-300">{racer.category}</td>
                  <td className="px-4 py-3">{racer.laps}</td>
                  <td className="px-4 py-3 text-teal-300">{racer.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {podium.length > 0 && (leader?.laps ?? 0) > 0 && (
          <section className="space-y-4">
            <div className="text-sm font-semibold text-slate-200">
              Подиумы по категориям
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {podium.map((group) => (
                <div
                  key={group.category}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow"
                >
                  <div className="bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-200">
                    {group.category}
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-2">Место</th>
                        <th className="px-4 py-2">Номер</th>
                        <th className="px-4 py-2">Гонщик</th>
                        <th className="px-4 py-2">Круги</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.riders.map((rider, index) => (
                        <tr
                          key={rider.bib}
                          className="border-t border-slate-800/60 text-slate-100"
                        >
                          <td className="px-4 py-2 font-semibold">{index + 1}</td>
                          <td className="px-4 py-2 text-slate-300">#{rider.bib}</td>
                          <td className="px-4 py-2">{rider.name}</td>
                          <td className="px-4 py-2">{rider.laps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>
        )}

        {totalTapCount === 0 && (
          <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
            Отметок пока нет. Откройте экран хронометража и начните отмечать
            гонщиков, чтобы увидеть таблицу в действии.
          </section>
        )}
      </div>
    </div>
  );
}
