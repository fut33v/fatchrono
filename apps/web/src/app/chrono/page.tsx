"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";
import { useRaceStore } from "@/store/race-store";

export default function ManualChronoPage() {
  const [query, setQuery] = useState("");

  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthInitialized = useAuthStore((state) => state.isInitialized);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);

  const riders = useRaceStore((state) => state.riders);
  const tapEvents = useRaceStore((state) => state.tapEvents);
  const upsertTapEvent = useRaceStore((state) => state.upsertTapEvent);
  const removeTapEvent = useRaceStore((state) => state.removeTapEvent);
  const isHydrated = useRaceStore((state) => state.isHydrated);
  const isConnected = useRaceStore((state) => state.isConnected);
  const error = useRaceStore((state) => state.error);
  const setError = useRaceStore((state) => state.setError);

  const filteredRiders = useMemo(() => {
    if (!query.trim()) {
      return riders;
    }

    const lowered = query.trim().toLowerCase();
    return riders.filter((rider) =>
      [rider.name, rider.category, rider.bib.toString()].some((field) =>
        field.toLowerCase().includes(lowered),
      ),
    );
  }, [query, riders]);

  const recentTaps = tapEvents.slice(0, 10);

  useEffect(() => {
    if (isAuthLoading || !isAuthInitialized) {
      return;
    }

    if (!user || user.role !== "admin") {
      router.replace("/login");
    }
  }, [isAuthInitialized, isAuthLoading, user, router]);

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
    try {
      const response = await fetch(`${API_BASE_URL}/race/taps`, {
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
      console.error("Не удалось отправить отметку", err);
      setError("Не удалось отправить отметку. Проверьте соединение.");
    }
  };

  const handleCancelTap = async (eventId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/race/taps/${eventId}`, {
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
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8">
        <header className="space-y-2">
          <div className="text-sm uppercase tracking-wide text-slate-400">
            Ручной хронометраж
          </div>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Отмечайте гонщиков при пересечении финишной линии
          </h1>
          <p className="text-sm text-slate-400">
            Интерфейс оптимизирован для планшетов и телефонов. Отметки сохраняются локально и синхронизируются при восстановлении связи.
          </p>
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

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredRiders.map((rider) => (
                <button
                  key={rider.bib}
                  type="button"
                  onClick={() => handleTap(rider.bib)}
                  className="flex min-h-[110px] flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-left shadow transition active:scale-[0.98] focus:border-teal-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!isHydrated}
                >
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      {rider.category}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-100">
                      #{rider.bib}
                    </div>
                  </div>
                  <span className="text-sm text-slate-300">{rider.name}</span>
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
              <h2 className="text-sm uppercase tracking-wide text-slate-400">
                Последние отметки
              </h2>
              <span className="text-xs text-slate-500">
                Показаны последние {recentTaps.length} из {tapEvents.length}
              </span>
            </header>
            <ol className="space-y-2 text-sm">
              {recentTaps.length === 0 && (
                <li className="text-slate-500">
                  Отметьте гонщика, и события появятся здесь.
                </li>
              )}
              {recentTaps.map((tap) => (
                <li
                  key={tap.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-200"
                >
                  <div className="space-y-0.5">
                    <strong className="block text-slate-100">
                      #{tap.bib} · {tap.name}
                    </strong>
                    <span className="block text-xs text-slate-400">
                      {tap.category}
                    </span>
                    <time className="block text-xs text-teal-300">
                      {new Date(tap.timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancelTap(tap.id)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-rose-500 hover:text-rose-400"
                  >
                    Отменить
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </div>
    </div>
  );
}
