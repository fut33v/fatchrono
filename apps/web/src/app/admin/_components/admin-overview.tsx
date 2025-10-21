"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";

type AdminRace = {
  id: string;
  slug: string | null;
  name: string;
  totalLaps: number;
  startedAt: number | null;
  tapCooldownSeconds: number;
  createdAt: number;
  categories: number;
  participants: number;
};

type ApiRace = {
  id: string;
  slug: string | null;
  name: string;
  totalLaps: number;
  tapCooldownSeconds: number;
  startedAt: number | null;
  createdAt: number;
  categories: Array<{ id: string }>;
  participants: Array<{ id: string }>;
};

type RacesResponse = {
  races: ApiRace[];
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

export default function AdminOverview() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoadingUser = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);

  const [races, setRaces] = useState<AdminRace[]>([]);
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreatingRace, setIsCreatingRace] = useState(false);
  const [raceForm, setRaceForm] = useState({
    name: "",
    slug: "",
    totalLaps: 20,
    tapCooldownSeconds: 0,
  });

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );

  useEffect(() => {
    if (!isInitialized || isLoadingUser) {
      return;
    }

    if (!user || user.role !== "admin") {
      router.replace("/login");
    }
  }, [user, isInitialized, isLoadingUser, router]);

  useEffect(() => {
    if (!token || !user || user.role !== "admin") {
      return;
    }

    void fetchRaces();
  }, [token, user]);

  async function authFetch(path: string, init?: RequestInit) {
    if (!token) {
      throw new Error("Требуется авторизация");
    }

    const headers = new Headers(init?.headers as HeadersInit);
    headers.set("Authorization", `Bearer ${token}`);

    if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Ошибка ${response.status}`);
    }

    return response;
  }

  async function fetchRaces() {
    try {
      setLoadingRaces(true);
      setError(undefined);
      const response = await authFetch("/race");
      const data = (await response.json()) as RacesResponse;
      const normalized: AdminRace[] = data.races.map((race) => ({
        id: race.id,
        slug: race.slug,
        name: race.name,
        totalLaps: race.totalLaps,
        tapCooldownSeconds: race.tapCooldownSeconds,
        startedAt: race.startedAt,
        createdAt: race.createdAt,
        categories: race.categories.length,
        participants: race.participants.length,
      }));
      setRaces(normalized);
    } catch (err) {
      console.error("Не удалось загрузить список гонок", err);
      setError("Не удалось загрузить список гонок");
    } finally {
      setLoadingRaces(false);
    }
  }

  async function handleCreateRace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsCreatingRace(true);
      setFeedback(undefined);
      setError(undefined);
      await authFetch("/race", {
        method: "POST",
        body: JSON.stringify({
          name: raceForm.name,
          slug: raceForm.slug || undefined,
          totalLaps: Number(raceForm.totalLaps),
          tapCooldownSeconds: Number(raceForm.tapCooldownSeconds),
        }),
      });
      setRaceForm({ name: "", slug: "", totalLaps: 20, tapCooldownSeconds: 0 });
      setFeedback("Гонка создана");
      setIsCreateFormOpen(false);
      await fetchRaces();
    } catch (err) {
      console.error("Не удалось создать гонку", err);
      setError("Не удалось создать гонку");
    } finally {
      setIsCreatingRace(false);
    }
  }

  if (!isInitialized || isLoadingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">Загружаем данные профиля…</p>
      </main>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">
              Админ-панель
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              Гонки платформы
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
          >
            Выйти
          </button>
        </header>

        {feedback && (
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-200">
            {feedback}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Список гонок</h2>
              <p className="text-sm text-slate-400">
                Нажмите на гонку, чтобы перейти в её детальную админ-панель.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCreateFormOpen((value) => !value);
                setFeedback(undefined);
                setError(undefined);
              }}
              className="rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/20"
            >
              {isCreateFormOpen ? "Скрыть форму" : "Создать гонку"}
            </button>
          </div>

          {isCreateFormOpen && (
            <form
              onSubmit={handleCreateRace}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                  Название гонки
                  <input
                    value={raceForm.name}
                    onChange={(event) =>
                      setRaceForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                  Slug
                  <input
                    value={raceForm.slug}
                    onChange={(event) =>
                      setRaceForm((prev) => ({ ...prev, slug: event.target.value }))
                    }
                    placeholder="например kriterium"
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                  Количество кругов
                  <input
                    value={raceForm.totalLaps}
                    onChange={(event) =>
                      setRaceForm((prev) => ({
                        ...prev,
                        totalLaps: Number(event.target.value),
                      }))
                    }
                    type="number"
                    min={1}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                  Кулдаун отметки (сек)
                  <input
                    value={raceForm.tapCooldownSeconds}
                    onChange={(event) =>
                      setRaceForm((prev) => ({
                        ...prev,
                        tapCooldownSeconds: Number(event.target.value),
                      }))
                    }
                    type="number"
                    min={0}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                0 — проверка отключена. При ненулевом значении повторные отметки потребуют подтверждения хронометриста.
              </p>
              <button
                type="submit"
                className="self-start rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30 disabled:opacity-60"
                disabled={isCreatingRace}
              >
                {isCreatingRace ? "Создаём…" : "Создать"}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {loadingRaces && (
              <p className="text-sm text-slate-400">Загружаем список гонок…</p>
            )}
            {!loadingRaces && races.length === 0 && (
              <p className="text-sm text-slate-400">Пока нет созданных гонок.</p>
            )}
            {!loadingRaces && races.length > 0 && (
              <ul className="space-y-2">
                {races.map((race) => {
                  const slugSegment = race.slug ?? race.id;
                  return (
                    <li key={race.id}>
                      <Link
                        href={`/admin/race/${encodeURIComponent(slugSegment)}`}
                        prefetch={false}
                        className="block rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-teal-400/60 hover:bg-slate-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1.5">
                            <h3 className="text-lg font-semibold text-slate-100">
                              {race.name}
                            </h3>
                            <p className="text-sm text-slate-400">
                              Кругов: {race.totalLaps} · Категорий: {race.categories} · Участников: {race.participants}
                            </p>
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Slug: {race.slug ? race.slug : "не задан"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                              race.startedAt
                                ? "border-teal-500/40 bg-teal-500/10 text-teal-200"
                                : "border-slate-700 bg-slate-900 text-slate-400"
                            }`}
                          >
                            {race.startedAt ? "Гонка идёт" : "Ожидает старта"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span>Создана: {formatDate(race.createdAt)}</span>
                          {origin && (
                            <span className="truncate">
                              {origin}/results/{encodeURIComponent(slugSegment)}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
