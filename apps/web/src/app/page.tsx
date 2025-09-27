import Link from "next/link";

import { API_BASE_URL } from "@/lib/config";

type PublicRace = {
  id: string;
  slug: string | null;
  name: string;
  totalLaps: number;
  startedAt: number | null;
  createdAt: number;
  participants: number;
  categories: number;
};

async function fetchPublicRaces(): Promise<PublicRace[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/race/public`, {
      next: { revalidate: 15 },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as PublicRace[] | { races: PublicRace[] };
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray((data as { races?: PublicRace[] }).races)) {
      return (data as { races: PublicRace[] }).races;
    }
    return [];
  } catch (err) {
    console.error("Не удалось загрузить список гонок", err);
    return [];
  }
}

function formatDate(timestamp: number) {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return formatter.format(new Date(timestamp));
}

export default async function HomePage() {
  const races = await fetchPublicRaces();

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
        <section className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">
              Доступные гонки
            </h1>
            <p className="text-sm text-slate-400">
              Нажмите на гонку, чтобы открыть результаты. Дополнительные экраны доступны внутри.
            </p>
          </div>

          {races.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
              Пока нет опубликованных гонок. Зайдите позже или создайте новую в админ-панели.
            </p>
          ) : (
            <ul className="grid gap-4">
              {races.map((race) => {
                const hasStarted = race.startedAt !== null;
                const pathSegment = race.slug ?? race.id;

                return (
                  <li
                    key={race.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm transition hover:border-teal-400/60 hover:bg-slate-900/70"
                  >
                    <Link
                      href={`/results/${encodeURIComponent(pathSegment)}`}
                      prefetch={false}
                      className="flex flex-col gap-3 p-6"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <h2 className="text-xl font-semibold text-slate-100">
                            {race.name}
                          </h2>
                          <p className="text-sm text-slate-400">
                            Кругов: {race.totalLaps} · Категорий: {race.categories} · Участников: {race.participants}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            hasStarted
                              ? "border-teal-500/40 bg-teal-500/10 text-teal-200"
                              : "border-slate-700 bg-slate-900 text-slate-400"
                          }`}
                        >
                          {hasStarted ? "Гонка идёт" : "Ожидает старта"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Создана: {formatDate(race.createdAt)}</span>
                        {race.startedAt && <span>Старт: {formatDate(race.startedAt)}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
