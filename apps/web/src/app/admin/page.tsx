"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";
import type { Category } from "@/store/race-store";

type Participant = {
  id: string;
  bib: number;
  name: string;
  categoryId?: string;
  team?: string;
};

type AdminRace = {
  id: string;
  name: string;
  totalLaps: number;
  createdAt: number;
  updatedAt: number;
  categories: Category[];
  participants: Participant[];
};

type RacesResponse = {
  races: AdminRace[];
  activeRaceId: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoadingUser = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);

  const [races, setRaces] = useState<AdminRace[]>([]);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const [raceForm, setRaceForm] = useState({ name: "", totalLaps: 20 });
  const [isCreatingRace, setIsCreatingRace] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [categorySavingId, setCategorySavingId] = useState<string | null>(null);

  const [participantForm, setParticipantForm] = useState({ bib: "", name: "", categoryId: "" });
  const [isCreatingParticipant, setIsCreatingParticipant] = useState(false);

  const activeRace = useMemo(
    () => races.find((race) => race.id === activeRaceId) ?? null,
    [races, activeRaceId],
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
    if (!activeRace) {
      setCategoryDrafts({});
      return;
    }

    const draft: Record<string, { name: string; description: string }> = {};
    for (const category of activeRace.categories) {
      draft[category.id] = {
        name: category.name,
        description: category.description ?? "",
      };
    }
    setCategoryDrafts(draft);
  }, [activeRace]);

  useEffect(() => {
    if (!token || !user || user.role !== "admin") {
      return;
    }

    void fetchRaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  async function authFetch(path: string, init?: RequestInit) {
    if (!token) {
      throw new Error("Требуется авторизация");
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
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
      const response = await authFetch('/race');
      const data = (await response.json()) as RacesResponse;
      setRaces(data.races);
      setActiveRaceId(data.activeRaceId ?? data.races[0]?.id ?? null);
    } catch (err) {
      console.error('Не удалось загрузить список гонок', err);
      setError('Не удалось загрузить список гонок');
    } finally {
      setLoadingRaces(false);
    }
  }

  async function handleCreateRace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsCreatingRace(true);
      setFeedback(undefined);
      await authFetch('/race', {
        method: 'POST',
        body: JSON.stringify({
          name: raceForm.name,
          totalLaps: Number(raceForm.totalLaps),
        }),
      });
      setRaceForm({ name: '', totalLaps: 20 });
      setFeedback('Гонка создана');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось создать гонку', err);
      setError('Не удалось создать гонку');
    } finally {
      setIsCreatingRace(false);
    }
  }

  async function handleActivateRace(raceId: string) {
    try {
      await authFetch(`/race/${raceId}/activate`, { method: 'POST' });
      setActiveRaceId(raceId);
      setFeedback('Активная гонка обновлена');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось активировать гонку', err);
      setError('Не удалось активировать гонку');
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRace) {
      return;
    }
    try {
      setIsCreatingCategory(true);
      setFeedback(undefined);
      await authFetch(`/race/${activeRace.id}/categories`, {
        method: 'POST',
        body: JSON.stringify({
          name: categoryForm.name,
          description: categoryForm.description || undefined,
        }),
      });
      setCategoryForm({ name: '', description: '' });
      setFeedback('Категория добавлена');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось добавить категорию', err);
      setError('Не удалось добавить категорию');
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function handleSaveCategory(categoryId: string) {
    if (!activeRace) {
      return;
    }
    const draft = categoryDrafts[categoryId];
    if (!draft) {
      return;
    }

    try {
      setCategorySavingId(categoryId);
      setFeedback(undefined);
      await authFetch(`/race/${activeRace.id}/categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          description: draft.description || undefined,
        }),
      });
      setFeedback('Категория обновлена');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось обновить категорию', err);
      setError('Не удалось обновить категорию');
    } finally {
      setCategorySavingId(null);
    }
  }

  async function handleCreateParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRace) {
      return;
    }

    const bibNumber = Number(participantForm.bib);
    if (!Number.isFinite(bibNumber) || bibNumber <= 0) {
      setError('Стартовый номер должен быть положительным числом');
      return;
    }

    try {
      setIsCreatingParticipant(true);
      setFeedback(undefined);
      await authFetch(`/race/${activeRace.id}/participants`, {
        method: 'POST',
        body: JSON.stringify({
          bib: bibNumber,
          name: participantForm.name,
          categoryId: participantForm.categoryId || undefined,
        }),
      });
      setParticipantForm({ bib: '', name: '', categoryId: '' });
      setFeedback('Участник добавлен');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось добавить участника', err);
      setError('Не удалось добавить участника');
    } finally {
      setIsCreatingParticipant(false);
    }
  }

  function renderRaceList() {
    if (loadingRaces) {
      return <p className="text-sm text-slate-400">Загружаем список гонок…</p>;
    }

    if (races.length === 0) {
      return <p className="text-sm text-slate-400">Пока нет созданных гонок.</p>;
    }

    return (
      <ul className="space-y-2">
        {races.map((race) => (
          <li
            key={race.id}
            className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-100">{race.name}</h3>
              <p className="text-xs text-slate-400">
                Кругов: {race.totalLaps} · Участников: {race.participants.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleActivateRace(race.id)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                race.id === activeRaceId
                  ? 'border-teal-400/70 bg-teal-500/10 text-teal-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-teal-400/50 hover:text-teal-200'
              }`}
            >
              {race.id === activeRaceId ? 'Текущая гонка' : 'Сделать активной'}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-wide text-slate-500">
                Админ-панель гонки
              </div>
              <h1 className="text-3xl font-semibold sm:text-4xl">
                Управляйте гонками, категориями и участниками
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
            >
              Выйти
            </button>
          </div>
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
        </header>

        <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-sm uppercase tracking-wide text-slate-400">
                Гонки
              </h2>
              <p className="text-sm text-slate-400">
                Создайте новую гонку и выберите активную, чтобы данные хронометража шли в нужный старт.
              </p>
            </div>
            <form
              onSubmit={handleCreateRace}
              className="flex w-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:w-96"
            >
              <h3 className="text-sm font-semibold text-slate-200">Новая гонка</h3>
              <input
                value={raceForm.name}
                onChange={(event) => setRaceForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Название гонки"
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                required
              />
              <input
                value={raceForm.totalLaps}
                onChange={(event) => setRaceForm((prev) => ({ ...prev, totalLaps: Number(event.target.value) }))}
                type="number"
                min={1}
                placeholder="Количество кругов"
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                required
              />
              <button
                type="submit"
                className="rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30"
                disabled={isCreatingRace}
              >
                {isCreatingRace ? 'Создаём…' : 'Создать'}
              </button>
            </form>
          </div>
          {renderRaceList()}
        </section>

        {activeRace && (
          <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <header className="space-y-1">
              <h2 className="text-sm uppercase tracking-wide text-slate-400">
                Категории
              </h2>
              <p className="text-sm text-slate-400">
                Изменения категорий мгновенно обновят результаты и экраны хронометража.
              </p>
            </header>

            <div className="grid gap-3">
              {activeRace.categories.length === 0 && (
                <p className="text-sm text-slate-500">Категории ещё не созданы.</p>
              )}
              {activeRace.categories
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((category) => (
                  <div
                    key={category.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex-1 space-y-2">
                      <input
                        value={categoryDrafts[category.id]?.name ?? ''}
                        onChange={(event) =>
                          setCategoryDrafts((prev) => ({
                            ...prev,
                            [category.id]: {
                              name: event.target.value,
                              description: prev[category.id]?.description ?? '',
                            },
                          }))
                        }
                        placeholder="Название категории"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                      />
                      <textarea
                        value={categoryDrafts[category.id]?.description ?? ''}
                        onChange={(event) =>
                          setCategoryDrafts((prev) => ({
                            ...prev,
                            [category.id]: {
                              name: prev[category.id]?.name ?? category.name,
                              description: event.target.value,
                            },
                          }))
                        }
                        placeholder="Описание (необязательно)"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                        rows={2}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveCategory(category.id)}
                      className="rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30"
                      disabled={categorySavingId === category.id}
                    >
                      {categorySavingId === category.id ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                  </div>
                ))}
            </div>

            <form
              onSubmit={handleCreateCategory}
              className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-200">Новая категория</h3>
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Название категории"
                required
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
              />
              <textarea
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Описание (необязательно)"
                rows={2}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teал-400/30"
              />
              <button
                type="submit"
                className="self-start rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30"
                disabled={isCreatingCategory}
              >
                {isCreatingCategory ? 'Добавляем…' : 'Добавить'}
              </button>
            </form>
          </section>
        )}

        {activeRace && (
          <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <header className="space-y-1">
              <h2 className="text-sm uppercase tracking-wide text-slate-400">Участники</h2>
              <p className="text-sm text-slate-400">
                Добавляйте гонщиков и фиксируйте стартовые номера. Категория автоматически проставится в хронометраже.
              </p>
            </header>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 text-left">Номер</th>
                    <th className="px-4 py-2 text-left">Гонщик</th>
                    <th className="px-4 py-2 text-left">Категория</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRace.participants.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-slate-500">
                        Участники ещё не добавлены.
                      </td>
                    </tr>
                  )}
                  {activeRace.participants
                    .slice()
                    .sort((a, b) => a.bib - b.bib)
                    .map((participant) => {
                      const categoryName = activeRace.categories.find((cat) => cat.id === participant.categoryId)?.name ?? 'Без категории';
                      return (
                        <tr key={participant.id} className="border-b border-slate-800/60">
                          <td className="px-4 py-2 font-semibold text-slate-100">#{participant.bib}</td>
                          <td className="px-4 py-2 text-slate-300">{participant.name}</td>
                          <td className="px-4 py-2 text-slate-400">{categoryName}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleCreateParticipant}
              className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-200">Добавить участника</h3>
              <div className="grid gap-3 sm:grid-cols-[100px,1fr]">
                <input
                  value={participantForm.bib}
                  onChange={(event) => setParticipantForm((prev) => ({ ...prev, bib: event.target.value }))}
                  type="number"
                  min={1}
                  placeholder="Номер"
                  required
                  className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                />
                <input
                  value={participantForm.name}
                  onChange={(event) => setParticipantForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Имя и фамилия"
                  required
                  className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                />
              </div>
              <select
                value={participantForm.categoryId}
                onChange={(event) => setParticipantForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
              >
                <option value="">Без категории</option>
                {activeRace.categories
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className="self-start rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30"
                disabled={isCreatingParticipant}
              >
                {isCreatingParticipant ? 'Добавляем…' : 'Добавить'}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
