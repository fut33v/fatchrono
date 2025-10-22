"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";
import { useRaceStore } from "@/store/race-store";

type VolunteerParticipant = {
  id: string;
  bib: number;
  name: string;
  categoryName: string;
  categoryId?: string;
  team?: string;
  isBibIssued: boolean;
};

type VolunteerRace = {
  id: string;
  name: string;
  slug: string | null;
  totalLaps: number;
  participants: VolunteerParticipant[];
};

type RaceResponse = {
  race: {
    id: string;
    name: string;
    slug: string | null;
    totalLaps: number;
    categories: Array<{ id: string; name: string }>;
    participants: Array<{
      id: string;
      bib: number;
      name: string;
      categoryId: string | null;
      team: string | null;
      isBibIssued: boolean;
    }>;
  };
};

function byBibAscending(a: VolunteerParticipant, b: VolunteerParticipant) {
  return a.bib - b.bib;
}

export function VolunteerDashboard({ slug }: { slug: string }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoadingUser = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);
  const setCurrentRace = useRaceStore((state) => state.setCurrentRace);
  const setResolvedRace = useRaceStore((state) => state.setResolvedRace);

  const [race, setRace] = useState<VolunteerRace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<string | undefined>();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isInitialized || isLoadingUser) {
      return;
    }
    if (!user || user.role !== "admin") {
      router.replace("/login");
    }
  }, [user, isInitialized, isLoadingUser, router]);

  useEffect(() => {
    if (slug) {
      setCurrentRace(slug);
    }
  }, [slug, setCurrentRace]);

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!token) {
        throw new Error("Требуется авторизация");
      }

      const headers = new Headers(init?.headers as HeadersInit);
      headers.set("Authorization", `Bearer ${token}`);

      const isFormData = init?.body instanceof FormData;
      if (!isFormData && !headers.has("Content-Type")) {
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
    },
    [token],
  );

  const loadRace = useCallback(async () => {
    if (!slug) {
      return;
    }
    try {
      setLoading(true);
      setError(undefined);
      setFeedback(undefined);

      const response = await authFetch(`/race/slug/${encodeURIComponent(slug)}`);
      const data = (await response.json()) as RaceResponse;

      const categoryMap = new Map(
        data.race.categories.map((category) => [category.id, category.name]),
      );

      const participants: VolunteerParticipant[] = data.race.participants.map(
        (participant) => ({
          id: participant.id,
          bib: participant.bib,
          name: participant.name,
          categoryId: participant.categoryId ?? undefined,
          categoryName:
            participant.categoryId && categoryMap.get(participant.categoryId)
              ? categoryMap.get(participant.categoryId) ?? "Без категории"
              : "Без категории",
          team: participant.team ?? undefined,
          isBibIssued: participant.isBibIssued,
        }),
      );

      setRace({
        id: data.race.id,
        name: data.race.name,
        slug: data.race.slug,
        totalLaps: data.race.totalLaps,
        participants,
      });

      setResolvedRace(data.race.id, data.race.slug ?? slug);
    } catch (err) {
      console.error("Не удалось загрузить гонку", err);
      setError("Не удалось загрузить гонку");
    } finally {
      setLoading(false);
    }
  }, [slug, authFetch]);

  useEffect(() => {
    if (!token || !slug) {
      return;
    }
    void loadRace();
  }, [token, slug, loadRace]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredParticipants = useMemo(() => {
    const participants = (race?.participants ?? []).slice();
    if (!normalizedQuery) {
      return participants;
    }

    return participants.filter((participant) => {
      const haystack = [
        participant.name,
        participant.categoryName,
        participant.team ?? "",
        String(participant.bib),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [race, normalizedQuery]);

  const awaitingParticipants = useMemo(() => {
    return filteredParticipants
      .filter((participant) => !participant.isBibIssued)
      .slice()
      .sort(byBibAscending);
  }, [filteredParticipants]);

  const issuedParticipants = useMemo(() => {
    return filteredParticipants
      .filter((participant) => participant.isBibIssued)
      .slice()
      .sort(byBibAscending);
  }, [filteredParticipants]);

  const totalParticipants = race?.participants.length ?? 0;

  const handleToggleIssue = async (participantId: string, nextStatus: boolean) => {
    if (!race) {
      return;
    }

    setPendingIds((prev) => new Set(prev).add(participantId));
    setFeedback(undefined);
    setError(undefined);

    try {
      await authFetch(
        `/race/${encodeURIComponent(race.id)}/participants/${encodeURIComponent(participantId)}/issue`,
        {
          method: "PATCH",
          body: JSON.stringify({ isIssued: nextStatus }),
        },
      );

      setRace((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          participants: prev.participants.map((participant) =>
            participant.id === participantId
              ? { ...participant, isBibIssued: nextStatus }
              : participant,
          ),
        } satisfies VolunteerRace;
      });

      setFeedback(nextStatus ? "Номерок выдан" : "Статус номера снят");
    } catch (err) {
      console.error("Не удалось обновить статус номера", err);
      setError("Не удалось обновить статус номера");
      await loadRace();
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    }
  };

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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm uppercase tracking-wide text-slate-500">Выдача номерков</div>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              {race?.name ?? "Выберите гонку"}
            </h1>
            {race?.slug && (
              <p className="text-xs text-slate-500">Адрес гонки: {race.slug}</p>
            )}
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

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-slate-400">
                Выдано номерков: {issuedParticipants.length} из {totalParticipants}
              </p>
              <p className="text-slate-500">
                Осталось выдать: {awaitingParticipants.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRace()}
              disabled={loading}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-teal-400 hover:text-teal-200 disabled:opacity-60"
            >
              {loading ? "Обновляем…" : "Обновить"}
            </button>
          </div>
          <div className="mt-4">
            <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-500">
              Поиск
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Имя, номер, категория…"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Нужно выдать</h2>
                <p className="text-xs text-slate-500">Гонщики, которые ещё не получили номер</p>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-400">
                {awaitingParticipants.length}
              </span>
            </header>
            <div className="grid gap-2">
              {awaitingParticipants.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
                  Все номерки выданы.
                </p>
              )}
              {awaitingParticipants.map((participant) => {
                const isPending = pendingIds.has(participant.id);
                return (
                  <div
                    key={participant.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-100">
                        #{participant.bib} · {participant.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {participant.categoryName}
                        {participant.team ? ` · ${participant.team}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleIssue(participant.id, true)}
                      disabled={isPending}
                      className="rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30 disabled:opacity-60"
                    >
                      {isPending ? "Выдаём…" : "Выдать номер"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Выданные номерки</h2>
                <p className="text-xs text-slate-500">Для контроля уже получивших номера</p>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-400">
                {issuedParticipants.length}
              </span>
            </header>
            <div className="grid gap-2">
              {issuedParticipants.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
                  Пока никто не получил номерок.
                </p>
              )}
              {issuedParticipants.map((participant) => {
                const isPending = pendingIds.has(participant.id);
                return (
                  <div
                    key={participant.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-100">
                        #{participant.bib} · {participant.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {participant.categoryName}
                        {participant.team ? ` · ${participant.team}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleIssue(participant.id, false)}
                      disabled={isPending}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-rose-400 hover:text-rose-200 disabled:opacity-60"
                    >
                      {isPending ? "Сохраняем…" : "Вернуть"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default VolunteerDashboard;
