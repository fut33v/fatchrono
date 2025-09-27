"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";
import { useRaceStore } from "@/store/race-store";

export default function ManualChronoPage() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthInitialized = useAuthStore((state) => state.isInitialized);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);

  const currentRaceId = useRaceStore((state) => state.currentRaceId);
  const currentRaceSlug = useRaceStore((state) => state.currentRaceSlug);
  const race = useRaceStore((state) => state.race);
  const riders = useRaceStore((state) => state.riders);
  const tapEvents = useRaceStore((state) => state.tapEvents);
  const upsertTapEvent = useRaceStore((state) => state.upsertTapEvent);
  const removeTapEvent = useRaceStore((state) => state.removeTapEvent);
  const isHydrated = useRaceStore((state) => state.isHydrated);
  const isConnected = useRaceStore((state) => state.isConnected);
  const error = useRaceStore((state) => state.error);
  const setError = useRaceStore((state) => state.setError);

  const [query, setQuery] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const [pendingCancelIds, setPendingCancelIds] = useState<string[]>([]);
  const lastTapAttemptRef = useRef<Map<number, number>>(new Map());

  const raceSegment = currentRaceSlug ?? currentRaceId;

  const lastTapByBib = useMemo(() => {
    const map = new Map<number, number>();
    for (const tap of tapEvents) {
      const current = map.get(tap.bib) ?? 0;
      if (tap.timestamp > current) {
        map.set(tap.bib, tap.timestamp);
      }
    }
    return map;
  }, [tapEvents]);

  useEffect(() => {
    if (lastTapAttemptRef.current.size === 0) {
      return;
    }

    for (const [bib, attemptTs] of lastTapAttemptRef.current) {
      const latest = lastTapByBib.get(bib) ?? 0;
      if (latest >= attemptTs) {
        lastTapAttemptRef.current.delete(bib);
      }
    }
  }, [lastTapByBib]);

  const filteredRiders = useMemo(() => {
    const ordered = [...riders].sort((a, b) => a.bib - b.bib);
    if (!query.trim()) {
      return ordered;
    }

    const lowered = query.trim().toLowerCase();
    return ordered.filter((rider) =>
      [rider.name, rider.category, rider.bib.toString()].some((value) =>
        value.toLowerCase().includes(lowered),
      ),
    );
  }, [query, riders]);

  useEffect(() => {
    if (isAuthLoading || !isAuthInitialized) {
      return;
    }

    if (!user || user.role !== "admin") {
      router.replace("/login");
    }
  }, [isAuthInitialized, isAuthLoading, user, router]);

  useEffect(() => {
    if (!race?.startedAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [race?.startedAt]);

  const elapsedLabel = useMemo(() => {
    if (!race?.startedAt) {
      return null;
    }

    const elapsedSeconds = Math.max(0, Math.floor((now - race.startedAt) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");

    return `${minutes}:${seconds}`;
  }, [now, race?.startedAt]);

  if (!isAuthInitialized || isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">Проверяем доступ…</p>
      </main>
    );
  }

  if (!user || user.role !== "admin" || !token) {
    return null;
  }

  const handleTap = async (bib: number) => {
    if (!currentRaceId) {
      setError("Выберите гонку перед отметкой");
      return;
    }

    const cooldownSeconds = race?.tapCooldownSeconds ?? 0;
    if (cooldownSeconds > 0) {
      const lastRecorded = lastTapByBib.get(bib) ?? 0;
      const lastAttempt = lastTapAttemptRef.current.get(bib) ?? 0;
      const lastTimestamp = Math.max(lastRecorded, lastAttempt);

      if (lastTimestamp > 0) {
        const diffMs = Date.now() - lastTimestamp;
        if (diffMs < cooldownSeconds * 1000) {
          const secondsAgoLabel = diffMs < 1000
            ? "менее секунды"
            : `${Math.floor(diffMs / 1000)} сек`;
          const remainingSeconds = Math.max(
            0,
            Math.ceil((cooldownSeconds * 1000 - diffMs) / 1000),
          );
          const confirmMessage = `Гонщик #${bib} уже был отмечен ${secondsAgoLabel} назад. Повторить отметку${
            remainingSeconds > 0 ? ` (кулдаун ${remainingSeconds} сек)` : ""
          }?`;

          if (!window.confirm(confirmMessage)) {
            return;
          }
        }
      }
    }

    const previousAttempt = lastTapAttemptRef.current.get(bib);
    try {
      setError(undefined);
      lastTapAttemptRef.current.set(bib, Date.now());
      const response = await fetch(`${API_BASE_URL}/race/${currentRaceId}/taps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bib, source: "manual" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const { event } = await response.json();
      upsertTapEvent(event);
      setError(undefined);
    } catch (err) {
      if (previousAttempt === undefined) {
        lastTapAttemptRef.current.delete(bib);
      } else {
        lastTapAttemptRef.current.set(bib, previousAttempt);
      }
      console.error("Не удалось отправить отметку", err);
      setError("Не удалось отправить отметку. Проверьте соединение.");
    }
  };

  const handleCancelTap = async (eventId: string) => {
    if (!currentRaceId) {
      setError("Нет выбранной гонки для отмены");
      return;
    }

    setPendingCancelIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));

    try {
      const response = await fetch(`${API_BASE_URL}/race/${currentRaceId}/taps/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      removeTapEvent(eventId);
      setError(undefined);
    } catch (err) {
      console.error("Не удалось отменить отметку", err);
      setError("Не удалось отменить отметку. Проверьте соединение.");
    } finally {
      setPendingCancelIds((prev) => prev.filter((id) => id !== eventId));
    }
  };

  const handleStartRace = async () => {
    if (!currentRaceId) {
      setError("Выберите гонку перед стартом");
      return;
    }

    try {
      setIsStarting(true);
      setLocalFeedback(undefined);

      const response = await fetch(`${API_BASE_URL}/race/${currentRaceId}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setLocalFeedback("Старт дан");

      if (!race?.startedAt && data.race?.startedAt) {
        setNow(Date.now());
      }

      setError(undefined);
    } catch (err) {
      console.error("Не удалось стартовать гонку", err);
      setError("Не удалось стартовать гонку. Проверьте соединение.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopRace = async () => {
    if (!currentRaceId) {
      setError("Выберите гонку перед остановкой");
      return;
    }

    try {
      setIsStopping(true);
      setLocalFeedback(undefined);

      const response = await fetch(`${API_BASE_URL}/race/${currentRaceId}/stop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setLocalFeedback("Гонка остановлена");

      if (race?.startedAt && !data.race?.startedAt) {
        setNow(Date.now());
      }

      setError(undefined);
    } catch (err) {
      console.error("Не удалось остановить гонку", err);
      setError("Не удалось остановить гонку. Проверьте соединение.");
    } finally {
      setIsStopping(false);
    }
  };

  if (!currentRaceId && !currentRaceSlug) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="max-w-md space-y-3 text-center text-sm text-slate-400">
          <p>Чтобы открыть ручной хронометраж, перейдите по ссылке вида `/chrono/&lt;slug&gt;`.</p>
          <p>Скопируйте ссылку из админки и откройте её на устройстве хронометриста.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8">
        <header className="space-y-2">
          <div className="text-sm uppercase tracking-wide text-slate-400">Ручной хронометраж</div>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            {race?.name ?? "Гонка"}: отмечайте гонщиков при пересечении финишной линии
          </h1>
          <p className="text-sm text-slate-400">
            Интерфейс оптимизирован для планшетов и телефонов. Отметки сохраняются локально и синхронизируются при восстановлении связи.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {race?.startedAt ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-teal-500/50 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-200">
                  Идёт гонка • {elapsedLabel ?? "00:00"}
                </div>
                <button
                  type="button"
                  onClick={handleStopRace}
                  disabled={isStopping}
                  className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:pointer-events-none disabled:opacity-60"
                >
                  {isStopping ? "Останавливаем…" : "Стоп"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartRace}
                disabled={isStarting}
                className="rounded-lg border border-teal-500/50 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teал-400 hover:bg-teal-500/20 disabled:opacity-60"
              >
                {isStarting ? "Стартуем…" : "Старт"}
              </button>
            )}
            {localFeedback && <span className="text-teal-200">{localFeedback}</span>}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="flex flex-col gap-4">
            {!isHydrated && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
                Загружаем текущий список гонщиков…
              </div>
            )}
            {!isConnected && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Нет соединения с сервером результатов. Проверьте сеть, чтобы отметки сохранялись для всех устройств.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="self-start rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
            >
              Выйти
            </button>
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
              <span className="text-slate-400">Ссылки:</span>
              <Link
                href={raceSegment ? `/results/${raceSegment}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-teal-400 hover:text-teal-200"
              >
                Результаты
              </Link>
              <Link
                href={raceSegment ? `/leaderboard/${raceSegment}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-teal-400 hover:text-teал-200"
              >
                Табло
              </Link>
            </div>
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по имени, номеру или категории"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
            />

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {filteredRiders.map((rider) => (
                <button
                  key={rider.bib}
                  type="button"
                  onClick={() => handleTap(rider.bib)}
                  className="flex min-h-[96px] flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-3 text-left shadow transition duration-150 focus:border-teal-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 hover:border-teal-400/70 hover:bg-slate-900/70 active:border-rose-500 active:bg-rose-600/20"
                  disabled={!isHydrated}
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">{rider.category}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-100">#{rider.bib}</div>
                  </div>
                  <span className="text-xs text-slate-300 sm:text-sm">{rider.name}</span>
                </button>
              ))}

              {filteredRiders.length === 0 && (
                <p className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
                  Ни один гонщик не найден. Попробуйте другой номер, имя или категорию.
                </p>
              )}
            </div>
          </div>

          <aside className="flex min-h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <header className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-wide text-slate-400">Журнал отметок</h2>
            </header>
            <ol className="space-y-2 text-sm">
              {tapEvents.length === 0 && (
                <li className="text-slate-500">Отметьте гонщика, и события появятся здесь.</li>
              )}
              {tapEvents.map((tap) => {
                const isCancelling = pendingCancelIds.includes(tap.id);
                return (
                  <li
                    key={tap.id}
                    className={`flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-200 transition ${
                      isCancelling ? 'animate-tap-cancel border-rose-500/60 bg-rose-500/10' : ''
                    }`}
                  >
                    <div className="space-y-0.5">
                      <strong className="block text-slate-100">#{tap.bib} · {tap.name}</strong>
                      <span className="block text-xs text-slate-400">{tap.category}</span>
                      <time className="block text-xs text-teal-300">
                        {new Date(tap.timestamp).toLocaleTimeString()}
                      </time>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancelTap(tap.id)}
                      disabled={isCancelling}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-rose-500 hover:text-rose-400 disabled:cursor-wait disabled:opacity-60"
                    >
                      Отменить
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </section>
      </div>
    </div>
  );
}
