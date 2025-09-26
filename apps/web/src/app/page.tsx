import Link from "next/link";

import { API_BASE_URL } from "@/lib/config";

const featureCards = [
  {
    href: "/admin",
    title: "Админ-панель гонки",
    description:
      "Создавайте гонки, управляйте списком участников и импортируйте заявки.",
  },
];

type PublicRace = {
  id: string;
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
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-950 from-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
        <header className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1 text-sm font-medium uppercase tracking-wide text-slate-300 shadow">
            FatChrono
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Платформа хронометража для критериумов, многодневок и любительских
            стартов.
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Авторизуйтесь через Telegram, фиксируйте круги удобными кнопками и
            транслируйте точные результаты гонщикам и зрителям за секунды.
          </p>
        </header>

        <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow transition hover:border-teal-400/70 hover:bg-slate-900/70"
            >
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-slate-100 group-hover:text-teal-300">
                  {card.title}
                </h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-200">
                  {card.description}
                </p>
              </div>
              <span className="mt-8 text-sm font-medium text-teal-300">
                Открыть →
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-20 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-100">
              Доступные гонки
            </h2>
            <p className="text-sm text-slate-400">
              Выберите гонку, чтобы открыть результаты, хронометраж или табло лидеров.
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
                return (
                  <li
                    key={race.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm transition hover:border-teal-400/60 hover:bg-slate-900/70"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-slate-100">
                          {race.name}
                        </h3>
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
                      {race.startedAt && (
                        <span>Старт: {formatDate(race.startedAt)}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/results/${race.id}`}
                        prefetch={false}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-teal-400 hover:text-teal-200"
                      >
                        Результаты
                      </Link>
                      <Link
                        href={`/leaderboard/${race.id}`}
                        prefetch={false}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-teal-400 hover:text-teal-200"
                      >
                        Табло лидеров
                      </Link>
                      <Link
                        href={`/chrono/${race.id}`}
                        prefetch={false}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-teal-400 hover:text-teал-200"
                      >
                        Хронометраж
                      </Link>
                    </div>
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
