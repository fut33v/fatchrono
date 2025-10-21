"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
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
  birthDate?: number | null;
};

type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  categoriesCreated: number;
  skippedRows: Array<{ rowIndex: number; reason: string }>;
};

type ParticipantSortField = "bib" | "name" | "category" | "birthDate";

type ParticipantSortState = {
  field: ParticipantSortField;
  direction: "asc" | "desc";
};

type ParticipantRow = Participant & {
  categoryName: string;
};

type AdminRace = {
  id: string;
  slug: string | null;
  name: string;
  totalLaps: number;
  startedAt: number | null;
  tapCooldownSeconds: number;
  createdAt: number;
  updatedAt: number;
  categories: Category[];
  participants: Participant[];
};

type RacesResponse = {
  races: AdminRace[];
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

type AdminDashboardProps = {
  raceSlug?: string;
};

export default function AdminDashboard({ raceSlug }: AdminDashboardProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoadingUser = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);

  const isStandalone = Boolean(raceSlug);

  const [races, setRaces] = useState<AdminRace[]>([]);
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null);
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const [raceForm, setRaceForm] = useState({ name: "", slug: "", totalLaps: 20, tapCooldownSeconds: 0 });
  const [isCreatingRace, setIsCreatingRace] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [raceDrafts, setRaceDrafts] = useState<Record<string, { name: string; slug: string; totalLaps: string; tapCooldownSeconds: string }>>({});
  const [raceSavingId, setRaceSavingId] = useState<string | null>(null);
  const [raceDeletingId, setRaceDeletingId] = useState<string | null>(null);
  const [categorySavingId, setCategorySavingId] = useState<string | null>(null);
  const [categoryDeletingId, setCategoryDeletingId] = useState<string | null>(null);

  const [participantForm, setParticipantForm] = useState({ bib: "", name: "", categoryId: "" });
  const [isCreatingParticipant, setIsCreatingParticipant] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportingParticipants, setIsImportingParticipants] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importInputKey, setImportInputKey] = useState(0);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantSort, setParticipantSort] = useState<ParticipantSortState>({
    field: "bib",
    direction: "asc",
  });
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(() => new Set());
  const [isDeletingParticipants, setIsDeletingParticipants] = useState(false);
  const [participantUpdatingId, setParticipantUpdatingId] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [isRaceSectionOpen, setIsRaceSectionOpen] = useState(true);
  const [isCategorySectionOpen, setIsCategorySectionOpen] = useState(true);
  const [isParticipantSectionOpen, setIsParticipantSectionOpen] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => new Set());

  const activeRace = useMemo(
    () => races.find((race) => race.id === activeRaceId) ?? null,
    [races, activeRaceId],
  );

  useEffect(() => {
    const drafts: Record<string, { name: string; slug: string; totalLaps: string; tapCooldownSeconds: string }> = {};
    for (const race of races) {
      drafts[race.id] = {
        name: race.name,
        slug: race.slug ?? "",
        totalLaps: race.totalLaps.toString(),
        tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
      };
    }
    setRaceDrafts(drafts);
  }, [races]);

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
    if (!activeRace) {
      setSelectedParticipantIds(new Set());
      return;
    }

    setSelectedParticipantIds((prev) => {
      const validIds = new Set(activeRace.participants.map((participant) => participant.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [activeRace]);

  useEffect(() => {
    setImportSummary(null);
    setImportFile(null);
    setImportInputKey((value) => value + 1);
    setParticipantSearch('');
    setParticipantSort({ field: 'bib', direction: 'asc' });
    setSelectedParticipantIds(new Set());
    setSelectedCategoryIds(new Set());
    setParticipantUpdatingId(null);
    setIsCategorySectionOpen(true);
    setIsParticipantSectionOpen(true);
  }, [activeRaceId]);

  useEffect(() => {
    if (!token || !user || user.role !== "admin") {
      return;
    }

    void fetchRaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );

  const formatBirthDate = useCallback((timestamp?: number | null) => {
    if (!timestamp) {
      return '—';
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleDateString('ru-RU');
  }, []);

  const participantsWithCategory = useMemo<ParticipantRow[]>(() => {
    if (!activeRace) {
      return [];
    }
    const categoryMap = new Map(activeRace.categories.map((category) => [category.id, category.name]));
    return activeRace.participants.map((participant) => ({
      ...participant,
      categoryName:
        participant.categoryId && categoryMap.has(participant.categoryId)
          ? categoryMap.get(participant.categoryId) ?? 'Без категории'
          : 'Без категории',
    }));
  }, [activeRace]);

  const filteredParticipants = useMemo<ParticipantRow[]>(() => {
    if (participantsWithCategory.length === 0) {
      return [];
    }

    const query = participantSearch.trim().toLowerCase();
    let collection = participantsWithCategory;

    if (query) {
      collection = collection.filter((participant) => {
        const haystack = [
          participant.name,
          participant.categoryName,
          participant.team ?? '',
          formatBirthDate(participant.birthDate),
          String(participant.bib),
        ];
        return haystack.some((value) => value.toLowerCase().includes(query));
      });
    }

    if (selectedCategoryIds.size > 0) {
      collection = collection.filter((participant) => {
        if (participant.categoryId) {
          return selectedCategoryIds.has(participant.categoryId);
        }
        return selectedCategoryIds.has('uncategorized');
      });
    }

    const sorted = [...collection].sort((a, b) => {
      const direction = participantSort.direction === 'asc' ? 1 : -1;
      switch (participantSort.field) {
        case 'name':
          return direction * a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        case 'category':
          return direction * a.categoryName.localeCompare(b.categoryName, 'ru', { sensitivity: 'base' });
        case 'birthDate': {
          const fallback = participantSort.direction === 'asc'
            ? Number.POSITIVE_INFINITY
            : Number.NEGATIVE_INFINITY;
          const aValue = a.birthDate ?? fallback;
          const bValue = b.birthDate ?? fallback;
          if (aValue === bValue) {
            return direction * (a.bib - b.bib);
          }
          return direction * (aValue - bValue);
        }
        case 'bib':
        default:
          return direction * (a.bib - b.bib);
      }
    });

    return sorted;
  }, [participantsWithCategory, participantSearch, participantSort, formatBirthDate, selectedCategoryIds]);

  const hasUncategorizedParticipants = useMemo(
    () => participantsWithCategory.some((participant) => !participant.categoryId),
    [participantsWithCategory],
  );

  const selectedCount = selectedParticipantIds.size;
  const allFilteredSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every((participant) => selectedParticipantIds.has(participant.id));

  const handleToggleCategoryFilter = useCallback((categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = selectedCount > 0 && !allFilteredSelected;
  }, [selectedCount, allFilteredSelected]);

  // Блок копирования ссылки удалён

  async function authFetch(path: string, init?: RequestInit) {
    if (!token) {
      throw new Error("Требуется авторизация");
    }

    const headers = new Headers(init?.headers as HeadersInit);
    headers.set('Authorization', `Bearer ${token}`);

    const isFormData = init?.body instanceof FormData;
    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
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

      if (isStandalone) {
        if (!raceSlug) {
          throw new Error('Не указан идентификатор гонки');
        }
        let response: Response | null = null;
        try {
          response = await authFetch(`/race/slug/${encodeURIComponent(raceSlug)}`);
        } catch (error) {
          response = await authFetch(`/race/${raceSlug}`);
        }
        const data = (await response.json()) as { race: AdminRace };
        setRaces([data.race]);
        setActiveRaceId(data.race.id);
      } else {
        const response = await authFetch('/race');
        const data = (await response.json()) as RacesResponse;
        setRaces(data.races);
        setActiveRaceId(null);
      }
    } catch (err) {
      console.error(isStandalone ? 'Не удалось загрузить гонку' : 'Не удалось загрузить список гонок', err);
      setError(isStandalone ? 'Не удалось загрузить гонку' : 'Не удалось загрузить список гонок');
    } finally {
      setLoadingRaces(false);
    }
  }

  function handleParticipantSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setParticipantSearch(event.target.value);
  }

  function handleSort(field: ParticipantSortField) {
    setParticipantSort((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { field, direction: 'asc' };
    });
  }

  const getSortIndicator = useCallback(
    (field: ParticipantSortField) => {
      if (participantSort.field !== field) {
        return '';
      }
      return participantSort.direction === 'asc' ? '▲' : '▼';
    },
    [participantSort],
  );

  function handleToggleSelectParticipant(participantId: string) {
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  }

  function handleToggleSelectAll() {
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      const shouldSelectAll = filteredParticipants.some(
        (participant) => !next.has(participant.id),
      );
      if (shouldSelectAll) {
        for (const participant of filteredParticipants) {
          next.add(participant.id);
        }
      } else {
        for (const participant of filteredParticipants) {
          next.delete(participant.id);
        }
      }
      return next;
    });
  }

  async function deleteParticipantsByIds(ids: string[], successMessage: string) {
    if (!activeRace || ids.length === 0) {
      return;
    }

    try {
      setIsDeletingParticipants(true);
      setFeedback(undefined);
      setError(undefined);

      await authFetch(`/race/${activeRace.id}/participants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      setFeedback(successMessage);
      setSelectedParticipantIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

      await fetchRaces();
    } catch (err) {
      console.error('Не удалось удалить участников', err);
      setError('Не удалось удалить участников');
    } finally {
      setIsDeletingParticipants(false);
    }
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selectedParticipantIds);
    if (ids.length === 0) {
      return;
    }

    if (!window.confirm(`Удалить ${ids.length} участник${ids.length === 1 ? 'а' : 'ов'}?`)) {
      return;
    }

    const message = ids.length > 1 ? 'Участники удалены' : 'Участник удалён';
    await deleteParticipantsByIds(ids, message);
  }

  async function handleDeleteSingle(participantId: string) {
    if (!window.confirm('Удалить этого участника?')) {
      return;
    }

    await deleteParticipantsByIds([participantId], 'Участник удалён');
  }

  async function handleChangeParticipantBib(participantId: string, currentBib: number) {
    if (!activeRace) {
      return;
    }

    const input = window.prompt('Новый стартовый номер', String(currentBib));
    if (input === null) {
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      setError('Стартовый номер не может быть пустым');
      return;
    }

    const nextBib = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(nextBib) || nextBib <= 0) {
      setError('Стартовый номер должен быть положительным целым числом');
      return;
    }

    if (nextBib === currentBib) {
      return;
    }

    try {
      setParticipantUpdatingId(participantId);
      setFeedback(undefined);
      setError(undefined);

      await authFetch(`/race/${activeRace.id}/participants/${participantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ bib: nextBib }),
      });

      setFeedback('Стартовый номер обновлён');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось изменить номер участника', err);
      setError('Не удалось изменить номер участника');
    } finally {
      setParticipantUpdatingId(null);
    }
  }

  function handleRaceDraftChange(
    raceId: string,
    field: 'name' | 'slug' | 'totalLaps' | 'tapCooldownSeconds',
    value: string,
  ) {
    setRaceDrafts((prev) => {
      const existing = prev[raceId] ?? {
        name: races.find((race) => race.id === raceId)?.name ?? '',
        slug: races.find((race) => race.id === raceId)?.slug ?? '',
        totalLaps: races.find((race) => race.id === raceId)?.totalLaps.toString() ?? '',
        tapCooldownSeconds: String(
          (races.find((race) => race.id === raceId)?.tapCooldownSeconds) ?? 0,
        ),
      };
      return {
        ...prev,
        [raceId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  }

  async function handleUpdateRaceName(raceId: string, rawName: string) {
    const race = races.find((item) => item.id === raceId);
    if (!race) {
      return;
    }

    const trimmed = rawName.trim();
    if (trimmed === race.name) {
      return;
    }

    if (!trimmed) {
      setError('Название гонки не может быть пустым');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            slug: race.slug ?? '',
            totalLaps: race.totalLaps.toString(),
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          name: race.name,
        },
      }));
      return;
    }

    try {
      setRaceSavingId(raceId);
      setFeedback(undefined);
      setError(undefined);
      await authFetch(`/race/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      });
      setFeedback('Название гонки обновлено');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось обновить название гонки', err);
      setError('Не удалось обновить название гонки');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            slug: race.slug ?? '',
            totalLaps: race.totalLaps.toString(),
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          name: race.name,
        },
      }));
    } finally {
      setRaceSavingId(null);
    }
  }

  async function handleUpdateRaceLaps(raceId: string, lapsValue: string) {
    const race = races.find((item) => item.id === raceId);
    if (!race) {
      return;
    }

    const parsed = Number.parseInt(lapsValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Количество кругов должно быть положительным целым числом');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            name: race.name,
            slug: race.slug ?? '',
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          totalLaps: race.totalLaps.toString(),
        },
      }));
      return;
    }

    if (parsed === race.totalLaps) {
      return;
    }

    try {
      setRaceSavingId(raceId);
      setFeedback(undefined);
      setError(undefined);
      await authFetch(`/race/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ totalLaps: parsed }),
      });
      setFeedback('Количество кругов обновлено');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось обновить количество кругов', err);
      setError('Не удалось обновить количество кругов');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            name: race.name,
            slug: race.slug ?? '',
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          totalLaps: race.totalLaps.toString(),
        },
      }));
    } finally {
      setRaceSavingId(null);
    }
  }

  async function handleUpdateRaceSlug(raceId: string, rawSlug: string) {
    const race = races.find((item) => item.id === raceId);
    if (!race) {
      return;
    }

    const trimmed = rawSlug.trim();
    const currentSlug = race.slug ?? '';

    if (trimmed === currentSlug) {
      return;
    }

    try {
      setRaceSavingId(raceId);
      setFeedback(undefined);
      setError(undefined);
      const response = await authFetch(`/race/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ slug: trimmed }),
      });
      const payload = (await response.json()) as { race: AdminRace };
      setFeedback(trimmed ? 'Адрес гонки обновлён' : 'Адрес гонки сброшен');
      await fetchRaces();
      if (isStandalone) {
        const nextSlug = payload.race.slug ?? payload.race.id;
        if (nextSlug && nextSlug !== raceSlug) {
          router.replace(`/admin/race/${encodeURIComponent(nextSlug)}`);
        }
      }
    } catch (err) {
      console.error('Не удалось обновить адрес гонки', err);
      setError('Не удалось обновить адрес гонки');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            name: race.name,
            totalLaps: race.totalLaps.toString(),
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          slug: currentSlug,
        },
      }));
    } finally {
      setRaceSavingId(null);
    }
  }

  async function handleUpdateRaceCooldown(
    raceId: string,
    cooldownValue: string,
  ) {
    const race = races.find((item) => item.id === raceId);
    if (!race) {
      return;
    }

    const trimmed = cooldownValue.trim();
    if (trimmed.length === 0) {
      setError('Кулдаун отметок не может быть пустым');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            name: race.name,
            slug: race.slug ?? '',
            totalLaps: race.totalLaps.toString(),
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
        },
      }));
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Кулдаун отметок должен быть неотрицательным целым числом');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            name: race.name,
            slug: race.slug ?? '',
            totalLaps: race.totalLaps.toString(),
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
        },
      }));
      return;
    }

    if (parsed === race.tapCooldownSeconds) {
      return;
    }

    try {
      setRaceSavingId(raceId);
      setFeedback(undefined);
      setError(undefined);
      await authFetch(`/race/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tapCooldownSeconds: parsed }),
      });
      setFeedback('Кулдаун отметок обновлён');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось обновить кулдаун отметок', err);
      setError('Не удалось обновить кулдаун отметок');
      setRaceDrafts((prev) => ({
        ...prev,
        [raceId]: {
          ...(prev[raceId] ?? {
            name: race.name,
            slug: race.slug ?? '',
            totalLaps: race.totalLaps.toString(),
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          }),
          tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
        },
      }));
    } finally {
      setRaceSavingId(null);
    }
  }

  async function handleCreateRace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isStandalone) {
      return;
    }
    try {
      setIsCreatingRace(true);
      setFeedback(undefined);
      await authFetch('/race', {
        method: 'POST',
        body: JSON.stringify({
          name: raceForm.name,
          slug: raceForm.slug,
          totalLaps: Number(raceForm.totalLaps),
          tapCooldownSeconds: Number(raceForm.tapCooldownSeconds),
        }),
      });
      setRaceForm({ name: '', slug: '', totalLaps: 20, tapCooldownSeconds: 0 });
      setFeedback('Гонка создана');
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось создать гонку', err);
      setError('Не удалось создать гонку');
    } finally {
      setIsCreatingRace(false);
    }
  }

  async function handleDeleteRace(raceId: string) {
    const race = races.find((item) => item.id === raceId);
    if (!race) {
      return;
    }

    if (!window.confirm(`Удалить гонку «${race.name}»? Действие необратимо.`)) {
      return;
    }

    try {
      setRaceDeletingId(raceId);
      setFeedback(undefined);
      setError(undefined);
      await authFetch(`/race/${raceId}`, { method: 'DELETE' });
      setFeedback('Гонка удалена');
      if (isStandalone) {
        router.replace('/admin');
      } else {
        await fetchRaces();
      }
    } catch (err) {
      console.error('Не удалось удалить гонку', err);
      setError('Не удалось удалить гонку');
    } finally {
      setRaceDeletingId(null);
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

  async function handleDeleteCategory(categoryId: string) {
    if (!activeRace) {
      return;
    }

    const category = activeRace.categories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const participantsInCategory = activeRace.participants.filter((participant) => participant.categoryId === categoryId);
    const message =
      participantsInCategory.length > 0
        ? `Удалить категорию «${category.name}»? У ${participantsInCategory.length} участник(ов) категория станет «Без категории».`
        : `Удалить категорию «${category.name}»?`;

    if (!window.confirm(message)) {
      return;
    }

    try {
      setCategoryDeletingId(categoryId);
      setFeedback(undefined);
      setError(undefined);
      await authFetch(`/race/${activeRace.id}/categories/${categoryId}`, {
        method: 'DELETE',
      });
      setFeedback('Категория удалена');
      setSelectedCategoryIds((prev) => {
        if (!prev.has(categoryId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось удалить категорию', err);
      setError('Не удалось удалить категорию');
    } finally {
      setCategoryDeletingId(null);
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

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setImportSummary(null);
  }

  async function handleImportParticipants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRace) {
      return;
    }

    if (!importFile) {
      setError('Выберите XLSX-файл для импорта');
      return;
    }

    try {
      setIsImportingParticipants(true);
      setFeedback(undefined);
      setError(undefined);

      const formData = new FormData();
      formData.append('file', importFile);

      const response = await authFetch(`/race/${activeRace.id}/participants/import`, {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as {
        created: Participant[];
        updated: Participant[];
        categoriesCreated: Category[];
        skipped: Array<{ rowIndex: number; reason: string }>;
      };

      setImportSummary({
        created: data.created.length,
        updated: data.updated.length,
        skipped: data.skipped.length,
        categoriesCreated: data.categoriesCreated.length,
        skippedRows: data.skipped,
      });
      setFeedback('Импорт участников завершён');
      setImportFile(null);
      setImportInputKey((value) => value + 1);
      await fetchRaces();
    } catch (err) {
      console.error('Не удалось импортировать участников', err);
      setError('Не удалось импортировать участников');
    } finally {
    setIsImportingParticipants(false);
  }

  }

  function renderRaceList() {
    if (loadingRaces) {
      return <p className="text-sm text-slate-400">Загружаем список гонок…</p>;
    }

    if (races.length === 0) {
      return <p className="text-sm text-slate-400">Пока нет созданных гонок.</p>;
    }

    if (!isStandalone) {
      return (
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
                      <h2 className="text-lg font-semibold text-slate-100">{race.name}</h2>
                      <p className="text-sm text-slate-400">
                        Кругов: {race.totalLaps} · Категорий: {race.categories.length} · Участников: {race.participants.length}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Slug: {race.slug ? race.slug : 'не задан'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        race.startedAt
                          ? "border-teal-500/40 bg-teal-500/10 text-teal-200"
                          : "border-slate-700 bg-slate-900 text-slate-400"
                      }`}
                    >
                      {race.startedAt ? 'Гонка идёт' : 'Ожидает старта'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span>Создана: {formatDate(race.createdAt)}</span>
                    {race.startedAt && <span>Старт: {formatDate(race.startedAt)}</span>}
                    <span>ID: {race.id}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <ul className="space-y-2">
        {races.map((race) => {
          const draft = raceDrafts[race.id] ?? {
            name: race.name,
            slug: race.slug ?? '',
            totalLaps: race.totalLaps.toString(),
            tapCooldownSeconds: String(race.tapCooldownSeconds ?? 0),
          };
          const isSaving = raceSavingId === race.id;
          const pathSegment = race.slug ?? race.id;

          return (
            <li
              key={race.id}
              className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex flex-1 flex-col gap-4">
                <Link
                  href={`/results/${encodeURIComponent(pathSegment)}`}
                  prefetch={false}
                  className="flex flex-col gap-4 rounded-xl border border-slate-800/50 bg-slate-900/40 p-5 transition hover:border-teal-400/50 hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold text-slate-100">{race.name}</h2>
                      <p className="text-sm text-slate-400">
                        Кругов: {race.totalLaps} · Категорий: {race.categories.length} · Участников: {race.participants.length}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        race.startedAt
                          ? "border-teal-500/40 bg-teal-500/10 text-teal-200"
                          : "border-slate-700 bg-slate-900 text-slate-400"
                      }`}
                    >
                      {race.startedAt ? 'Гонка идёт' : 'Ожидает старта'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Создана: {formatDate(race.createdAt)}</span>
                    {race.startedAt && <span>Старт: {formatDate(race.startedAt)}</span>}
                  </div>
                </Link>

                {origin && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                    <span className="text-slate-400">Поделиться:</span>
                    <Link
                      className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-teal-400 hover:text-teal-200"
                      href={`/results/${encodeURIComponent(pathSegment)}`}
                      prefetch={false}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Результаты
                    </Link>
                    <Link
                      className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-teal-400 hover:text-teал-200"
                      href={`/chrono/${encodeURIComponent(pathSegment)}`}
                      prefetch={false}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Хронограф
                    </Link>
                    <Link
                      className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-teal-400 hover:text-teал-200"
                      href={`/leaderboard/${encodeURIComponent(pathSegment)}`}
                      prefetch={false}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Лидер
                    </Link>
                  </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <label
                    className="flex w-full flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 sm:w-80"
                    htmlFor={"race-name-" + race.id}
                  >
                    Название
                    <input
                      id={"race-name-" + race.id}
                      value={draft.name}
                      onChange={(event) => handleRaceDraftChange(race.id, 'name', event.target.value)}
                      onBlur={(event) => handleUpdateRaceName(race.id, event.target.value)}
                      disabled={isSaving}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30 disabled:opacity-60"
                    />
                  </label>
                  <label
                    className="flex w-full flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 sm:w-56"
                    htmlFor={"race-slug-" + race.id}
                  >
                    Адрес (slug)
                    <input
                      id={"race-slug-" + race.id}
                      value={draft.slug ?? ''}
                      onChange={(event) => handleRaceDraftChange(race.id, 'slug', event.target.value)}
                      onBlur={(event) => handleUpdateRaceSlug(race.id, event.target.value)}
                      disabled={isSaving}
                      placeholder="naprimer-kriterium"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30 disabled:opacity-60"
                    />
                  </label>
                  <label
                    className="flex w-full flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 sm:w-40"
                    htmlFor={"race-laps-" + race.id}
                  >
                    Количество кругов
                    <input
                      id={"race-laps-" + race.id}
                      value={draft.totalLaps}
                      onChange={(event) => handleRaceDraftChange(race.id, 'totalLaps', event.target.value)}
                      onBlur={(event) => handleUpdateRaceLaps(race.id, event.target.value)}
                      disabled={isSaving}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30 disabled:opacity-60"
                    />
                  </label>
                  <label
                    className="flex w-full flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 sm:w-40"
                    htmlFor={"race-cooldown-" + race.id}
                  >
                    Кулдаун отметки (сек)
                    <input
                      id={"race-cooldown-" + race.id}
                      value={draft.tapCooldownSeconds ?? String(race.tapCooldownSeconds ?? 0)}
                      onChange={(event) =>
                        handleRaceDraftChange(
                          race.id,
                          'tapCooldownSeconds',
                          event.target.value,
                        )
                      }
                      onBlur={(event) =>
                        handleUpdateRaceCooldown(race.id, event.target.value)
                      }
                      disabled={isSaving}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30 disabled:opacity-60"
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  <span className="font-medium text-slate-300">ID:</span> {race.id}{race.slug ? (<> · <span className="font-medium text-slate-300">Slug:</span> {race.slug}</>) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteRace(race.id)}
                    disabled={raceDeletingId === race.id}
                    className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:opacity-60"
                  >
                    {raceDeletingId === race.id ? 'Удаляем…' : 'Удалить'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  if (!isInitialized || isLoadingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">Загружаем данные профиля…</p>
      </main>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
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
            <div className="space-y-2">
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-200">
                {feedback}
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => setIsRaceSectionOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-slate-200 transition hover:bg-slate-900/60"
          >
            <div className="space-y-2">
              <div className="text-sm uppercase tracking-wide text-slate-400">
                {isStandalone ? 'Гонка' : 'Гонки'}
              </div>
              <p className="text-sm text-slate-400">
                {isStandalone
                  ? 'Редактируйте параметры и состав выбранной гонки. Все изменения применяются мгновенно.'
                  : 'Создайте новую гонку и выберите активную, чтобы данные хронометража шли в нужный старт.'}
              </p>
            </div>
            <span className="text-2xl leading-none text-slate-500">
              {isRaceSectionOpen ? '−' : '+'}
            </span>
          </button>

          {isRaceSectionOpen && (
            <div className="space-y-6 border-t border-slate-800/70 px-6 pb-6 pt-4">
              {!isStandalone && (
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
                  value={raceForm.slug}
                  onChange={(event) => setRaceForm((prev) => ({ ...prev, slug: event.target.value }))}
                  placeholder="Адрес гонки (slug, например kriterium)"
                  className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                />
                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                  Количество кругов
                  <input
                    value={raceForm.totalLaps}
                    onChange={(event) => setRaceForm((prev) => ({ ...prev, totalLaps: Number(event.target.value) }))}
                    type="number"
                    min={1}
                    placeholder="Например 15"
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
                    placeholder="0"
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                  />
                </label>
                <p className="text-xs text-slate-500">
                  0 — проверка отключена. При ненулевом значении повторные отметки потребуют подтверждения хронометриста.
                </p>
                <button
                  type="submit"
                  className="rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30"
                  disabled={isCreatingRace}
                >
                  {isCreatingRace ? 'Создаём…' : 'Создать'}
                </button>
              </form>
              )}

              {renderRaceList()}
            </div>
          )}
        </section>

        {isStandalone && activeRace && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
            <button
              type="button"
              onClick={() => setIsCategorySectionOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-slate-200 transition hover:bg-slate-900/60"
            >
              <div className="space-y-2">
                <div className="text-sm uppercase tracking-wide text-slate-400">Категории</div>
                <p className="text-sm text-slate-400">
                  Изменения категорий мгновенно обновят результаты и экраны хронометража.
                </p>
              </div>
              <span className="text-2xl leading-none text-slate-500">
                {isCategorySectionOpen ? '−' : '+'}
              </span>
            </button>

            {isCategorySectionOpen && (
              <div className="space-y-6 border-t border-slate-800/70 px-6 pb-6 pt-4">
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
                        <div className="flex flex-col gap-2 sm:w-40 sm:flex-none sm:items-end">
                          <button
                            type="button"
                            onClick={() => handleSaveCategory(category.id)}
                            className="rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30 disabled:opacity-60"
                            disabled={categorySavingId === category.id || categoryDeletingId === category.id}
                          >
                            {categorySavingId === category.id ? 'Сохраняем…' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:opacity-60"
                            disabled={categoryDeletingId === category.id || categorySavingId === category.id}
                          >
                            {categoryDeletingId === category.id ? 'Удаляем…' : 'Удалить'}
                          </button>
                        </div>
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
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                  />
                  <button
                    type="submit"
                    className="self-start rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30"
                    disabled={isCreatingCategory}
                  >
                    {isCreatingCategory ? 'Добавляем…' : 'Добавить'}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {isStandalone && activeRace && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
            <button
              type="button"
              onClick={() => setIsParticipantSectionOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-slate-200 transition hover:bg-slate-900/60"
            >
              <div className="space-y-2">
                <div className="text-sm uppercase tracking-wide text-slate-400">Участники</div>
                <p className="text-sm text-slate-400">
                  Добавляйте гонщиков и фиксируйте стартовые номера. Категория автоматически проставится в хронометраже.
                </p>
              </div>
              <span className="text-2xl leading-none text-slate-500">
                {isParticipantSectionOpen ? '−' : '+'}
              </span>
            </button>

            {isParticipantSectionOpen && (
              <div className="space-y-6 border-t border-slate-800/70 px-6 pb-6 pt-4">
                <form
                  onSubmit={handleImportParticipants}
                  className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-200">Импорт из Excel</h3>
                  <p className="text-xs text-slate-400">
                    Загрузите файл формата XLSX. Используйте столбцы «Номер», «Имя», «Фамилия», «Пол», «Дистанция», «Дата рождения» и «Команда».
                  </p>
                  <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-slate-500">
                    Файл Excel
                    <input
                      key={importInputKey}
                      type="file"
                      accept=".xlsx"
                      onChange={handleImportFileChange}
                      className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-wide file:text-slate-300 focus:border-teal-400/70 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <button
                      type="submit"
                      disabled={!importFile || isImportingParticipants}
                      className="rounded-lg border border-teal-500/40 bg-teal-500/20 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:border-teal-400 hover:bg-teal-500/30 disabled:opacity-60"
                    >
                      {isImportingParticipants ? 'Импортируем…' : 'Импортировать'}
                    </button>
                    {importFile && <span className="text-slate-300">Выбран файл: {importFile.name}</span>}
                  </div>
                  {importSummary && (
                    <div className="space-y-2 rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-100">
                      <p>Добавлено: {importSummary.created}</p>
                      <p>Обновлено: {importSummary.updated}</p>
                      <p>Новые категории: {importSummary.categoriesCreated}</p>
                      <p>Пропущено строк: {importSummary.skipped}</p>
                      {importSummary.skipped > 0 && (
                        <details className="rounded border border-teal-500/20 bg-slate-900/60 p-2 text-xs text-teal-200">
                          <summary className="cursor-pointer select-none">Причины пропуска</summary>
                          <ul className="mt-2 space-y-1 text-teal-100">
                            {importSummary.skippedRows.slice(0, 10).map((item) => (
                              <li key={item.rowIndex}>
                                Строка {item.rowIndex}: {item.reason}
                              </li>
                            ))}
                            {importSummary.skippedRows.length > 10 && (
                              <li>… и ещё {importSummary.skippedRows.length - 10} строк</li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </form>

                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="flex w-full flex-col gap-2 text-xs uppercase tracking-wide text-slate-500 sm:max-w-xs">
                      Поиск
                      <input
                        value={participantSearch}
                        onChange={handleParticipantSearchChange}
                        placeholder="Поиск по имени, номеру или категории"
                        className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/30"
                        type="search"
                      />
                    </label>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                    <span className="text-slate-400">Категории:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryIds(new Set())}
                      className={`rounded border px-2 py-1 transition ${selectedCategoryIds.size === 0 ? 'border-teal-400 text-teal-200' : 'border-slate-700 text-slate-300 hover:border-teal-400 hover:text-teal-200'}`}
                    >
                      Все
                    </button>
                    {activeRace.categories
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((category) => {
                        const isActive = selectedCategoryIds.has(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => handleToggleCategoryFilter(category.id)}
                            className={`rounded border px-2 py-1 transition ${isActive ? 'border-teal-400 text-teal-200' : 'border-slate-700 text-slate-300 hover:border-teal-400 hover:text-teal-200'}`}
                          >
                            {category.name}
                          </button>
                        );
                      })}
                    {hasUncategorizedParticipants && (
                      <button
                        type="button"
                        onClick={() => handleToggleCategoryFilter('uncategorized')}
                        className={`rounded border px-2 py-1 transition ${selectedCategoryIds.has('uncategorized') ? 'border-teal-400 text-teal-200' : 'border-slate-700 text-slate-300 hover:border-teal-400 hover:text-teal-200'}`}
                      >
                        Без категории
                      </button>
                    )}
                  </div>
                  <span className="text-slate-300">
                    Видно: {filteredParticipants.length} / {participantsWithCategory.length}
                  </span>
                      <span className="text-slate-300">Выбрано: {selectedCount}</span>
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        disabled={filteredParticipants.length === 0}
                        className="rounded border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-teal-400 hover:text-teal-200 disabled:opacity-50"
                      >
                        {allFilteredSelected ? 'Снять выделение' : 'Выделить всё'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleDeleteSelected(); }}
                        disabled={selectedCount === 0 || isDeletingParticipants}
                        className="rounded border border-rose-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:opacity-50"
                      >
                        {isDeletingParticipants ? 'Удаляем…' : 'Удалить выбранных'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800 text-sm">
                      <thead>
                        <tr className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                          <th className="w-10 px-3 py-2">
                            <input
                              ref={selectAllRef}
                              type="checkbox"
                              className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-teal-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                              checked={filteredParticipants.length > 0 && allFilteredSelected}
                              onChange={handleToggleSelectAll}
                              aria-label="Выбрать всех показанных участников"
                            />
                          </th>
                          <th className="px-4 py-2 text-left">
                            <button
                              type="button"
                              onClick={() => handleSort('bib')}
                              className="inline-flex items-center gap-1 text-slate-300 transition hover:text-teal-200"
                            >
                              Номер
                              <span aria-hidden className="text-teal-300">
                                {getSortIndicator('bib')}
                              </span>
                            </button>
                          </th>
                          <th className="px-4 py-2 text-left">
                            <button
                              type="button"
                              onClick={() => handleSort('name')}
                              className="inline-flex items-center gap-1 text-slate-300 transition hover:text-teal-200"
                            >
                              Гонщик
                              <span aria-hidden className="text-teal-300">
                                {getSortIndicator('name')}
                              </span>
                            </button>
                          </th>
                          <th className="px-4 py-2 text-left">
                            <button
                              type="button"
                              onClick={() => handleSort('category')}
                              className="inline-flex items-center gap-1 text-slate-300 transition hover:text-teal-200"
                            >
                              Категория
                              <span aria-hidden className="text-teal-300">
                                {getSortIndicator('category')}
                              </span>
                            </button>
                          </th>
                          <th className="px-4 py-2 text-left">
                            <button
                              type="button"
                              onClick={() => handleSort('birthDate')}
                              className="inline-flex items-center gap-1 text-slate-300 transition hover:text-teal-200"
                            >
                              Дата рождения
                              <span aria-hidden className="text-teal-300">
                                {getSortIndicator('birthDate')}
                              </span>
                            </button>
                          </th>
                          <th className="px-4 py-2 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                              {participantsWithCategory.length === 0
                                ? 'Участники ещё не добавлены.'
                                : 'Нет совпадений по выбранным фильтрам.'}
                            </td>
                          </tr>
                        )}
                        {filteredParticipants.map((participant) => (
                          <tr key={participant.id} className="border-b border-slate-800/60">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-teal-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                                checked={selectedParticipantIds.has(participant.id)}
                                onChange={() => handleToggleSelectParticipant(participant.id)}
                                aria-label={`Выбрать участника ${participant.name}`}
                              />
                            </td>
                            <td className="px-4 py-2 font-semibold text-slate-100">#{participant.bib}</td>
                            <td className="px-4 py-2 text-slate-300">{participant.name}</td>
                            <td className="px-4 py-2 text-slate-400">{participant.categoryName}</td>
                            <td className="px-4 py-2 text-slate-400">{formatBirthDate(participant.birthDate)}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleChangeParticipantBib(participant.id, participant.bib)}
                              disabled={participantUpdatingId === participant.id || isDeletingParticipants}
                              className="rounded border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-teal-400 hover:text-teal-200 disabled:opacity-50"
                            >
                              {participantUpdatingId === participant.id ? 'Сохраняем…' : 'Номер'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDeleteSingle(participant.id); }}
                              disabled={isDeletingParticipants || participantUpdatingId === participant.id}
                              className="rounded border border-rose-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:opacity-50"
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
              </div>
            )}
          </section>
        )
}
      </div>
    </div>
  );
}
