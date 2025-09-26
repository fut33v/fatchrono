import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Category,
  Participant,
  Race,
  RaceBroadcastEvent,
  RaceStatePayload,
  Rider,
  TapEvent,
} from './race.types';

const MAX_TAP_HISTORY = 200;

type CreateRaceOptions = {
  name: string;
  totalLaps: number;
};

type CreateCategoryOptions = {
  name: string;
  description?: string;
  order?: number;
};

type UpdateCategoryOptions = {
  name?: string;
  description?: string;
  order?: number;
};

type CreateParticipantOptions = {
  bib: number;
  name: string;
  categoryId?: string;
  team?: string;
};

type UpdateParticipantOptions = {
  bib?: number;
  name?: string;
  categoryId?: string | null;
  team?: string | null;
};

@Injectable()
export class RaceService {
  private readonly races = new Map<string, Race>();
  private readonly tapEventsByRace = new Map<string, TapEvent[]>();
  private readonly listeners = new Set<(event: RaceBroadcastEvent) => void>();
  private activeRaceId: string | null = null;

  constructor() {
    const demoRace = this.createRace({ name: 'Демо-группа', totalLaps: 20 }, false);
    const catOpen = this.addCategory(demoRace.id, { name: 'Открытый класс' });
    const catWomen = this.addCategory(demoRace.id, { name: 'Женщины Элита' });

    this.addParticipant(demoRace.id, {
      bib: 12,
      name: 'Алиса В.',
      categoryId: catWomen.id,
    });
    this.addParticipant(demoRace.id, {
      bib: 44,
      name: 'Бруно К.',
      categoryId: catOpen.id,
    });
    this.addParticipant(demoRace.id, {
      bib: 5,
      name: 'Карла С.',
      categoryId: catWomen.id,
    });
    this.addParticipant(demoRace.id, {
      bib: 21,
      name: 'Диего Р.',
      categoryId: catOpen.id,
    });

    this.setActiveRace(demoRace.id);
  }

  getState(): RaceStatePayload {
    const race = this.getActiveRace();
    if (!race) {
      return {
        race: null,
        categories: [],
        riders: [],
        tapEvents: [],
      } satisfies RaceStatePayload;
    }

    const tapEvents = this.tapEventsByRace.get(race.id) ?? [];
    return {
      race: {
        id: race.id,
        name: race.name,
        totalLaps: race.totalLaps,
      },
      categories: race.categories,
      riders: race.participants.map((participant) => this.toRider(race, participant)),
      tapEvents,
    } satisfies RaceStatePayload;
  }

  getStateForRace(raceId: string): RaceStatePayload {
    const race = this.getRaceOrThrow(raceId);
    const tapEvents = this.tapEventsByRace.get(race.id) ?? [];
    return {
      race: {
        id: race.id,
        name: race.name,
        totalLaps: race.totalLaps,
      },
      categories: race.categories,
      riders: race.participants.map((participant) => this.toRider(race, participant)),
      tapEvents,
    } satisfies RaceStatePayload;
  }

  getLapsRemaining(): {
    race: { id: string; name: string; totalLaps: number } | null;
    leader?: { bib: number; name: string; lapsCompleted: number; lapsRemaining: number };
  } {
    const state = this.getState();
    if (!state.race) {
      return { race: null };
    }

    const lapCounts = new Map<number, number>();
    for (const event of state.tapEvents) {
      lapCounts.set(event.bib, (lapCounts.get(event.bib) ?? 0) + 1);
    }

    let leaderBib: number | undefined;
    let leaderLaps = -1;

    for (const rider of state.riders) {
      const laps = lapCounts.get(rider.bib) ?? 0;
      if (laps > leaderLaps) {
        leaderLaps = laps;
        leaderBib = rider.bib;
      }
    }

    if (leaderBib === undefined || leaderLaps < 0) {
      return { race: state.race };
    }

    const leaderRider = state.riders.find((rider) => rider.bib === leaderBib);
    const lapsRemaining = Math.max(state.race.totalLaps - leaderLaps, 0);

    return {
      race: state.race,
      leader: {
        bib: leaderBib,
        name: leaderRider?.name ?? `Гонщик #${leaderBib}`,
        lapsCompleted: leaderLaps,
        lapsRemaining,
      },
    };
  }

  getLapsRemainingForRace(raceId: string) {
    const state = this.getStateForRace(raceId);
    if (!state.race) {
      return { race: null };
    }

    const lapCounts = new Map<number, number>();
    for (const event of state.tapEvents) {
      lapCounts.set(event.bib, (lapCounts.get(event.bib) ?? 0) + 1);
    }

    let leaderBib: number | undefined;
    let leaderLaps = -1;

    for (const rider of state.riders) {
      const laps = lapCounts.get(rider.bib) ?? 0;
      if (laps > leaderLaps) {
        leaderLaps = laps;
        leaderBib = rider.bib;
      }
    }

    if (leaderBib === undefined || leaderLaps < 0) {
      return { race: state.race };
    }

    const leaderRider = state.riders.find((rider) => rider.bib === leaderBib);
    const lapsRemaining = Math.max(state.race.totalLaps - leaderLaps, 0);

    return {
      race: state.race,
      leader: {
        bib: leaderBib,
        name: leaderRider?.name ?? `Гонщик #${leaderBib}`,
        lapsCompleted: leaderLaps,
        lapsRemaining,
      },
    };
  }

  getRaces(): Race[] {
    return Array.from(this.races.values());
  }

  createRace(options: CreateRaceOptions, emitEvent = true): Race {
    if (!options.name?.trim()) {
      throw new BadRequestException('Название гонки обязательно');
    }
    if (!Number.isFinite(options.totalLaps) || options.totalLaps <= 0) {
      throw new BadRequestException('Количество кругов должно быть больше нуля');
    }

    const now = Date.now();
    const race: Race = {
      id: randomUUID(),
      name: options.name.trim(),
      totalLaps: Math.trunc(options.totalLaps),
      createdAt: now,
      updatedAt: now,
      categories: [],
      participants: [],
    };

    this.races.set(race.id, race);
    this.tapEventsByRace.set(race.id, []);

    if (emitEvent) {
      this.emitRaceUpdate();
    }

    return race;
  }

  setActiveRace(raceId: string): Race {
    const race = this.races.get(raceId);
    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    this.activeRaceId = raceId;
    this.emitRaceUpdate();
    return race;
  }

  addCategory(raceId: string, options: CreateCategoryOptions): Category {
    const race = this.getRaceOrThrow(raceId);
    if (!options.name?.trim()) {
      throw new BadRequestException('Имя категории обязательно');
    }

    const category: Category = {
      id: randomUUID(),
      name: options.name.trim(),
      description: options.description?.trim() || undefined,
      order: options.order ?? race.categories.length,
    };

    race.categories = [...race.categories, category];
    race.updatedAt = Date.now();
    if (this.isActiveRace(race.id)) {
      this.emitRaceUpdate();
    }

    return category;
  }

  updateCategory(
    raceId: string,
    categoryId: string,
    options: UpdateCategoryOptions,
  ): Category {
    const race = this.getRaceOrThrow(raceId);
    const idx = race.categories.findIndex((category) => category.id === categoryId);
    if (idx === -1) {
      throw new NotFoundException('Категория не найдена');
    }

    const existing = race.categories[idx];
    const updated: Category = {
      ...existing,
      name: options.name?.trim() || existing.name,
      description: options.description === undefined ? existing.description : options.description.trim() || undefined,
      order: options.order ?? existing.order,
    };

    race.categories = [
      ...race.categories.slice(0, idx),
      updated,
      ...race.categories.slice(idx + 1),
    ];
    race.updatedAt = Date.now();

    if (this.isActiveRace(race.id)) {
      this.updateTapEventsCategoryName(race.id, categoryId, updated.name);
      this.emitRaceUpdate();
    }

    return updated;
  }

  addParticipant(raceId: string, options: CreateParticipantOptions): Participant {
    const race = this.getRaceOrThrow(raceId);
    const bib = Math.trunc(options.bib);
    if (!Number.isFinite(bib) || bib <= 0) {
      throw new BadRequestException('Стартовый номер должен быть положительным числом');
    }

    if (!options.name?.trim()) {
      throw new BadRequestException('Имя участника обязательно');
    }

    if (race.participants.some((participant) => participant.bib === bib)) {
      throw new BadRequestException('Участник с таким номером уже существует');
    }

    if (options.categoryId) {
      this.ensureCategoryExists(race, options.categoryId);
    }

    const participant: Participant = {
      id: randomUUID(),
      bib,
      name: options.name.trim(),
      categoryId: options.categoryId,
      team: options.team?.trim() || undefined,
    };

    race.participants = [...race.participants, participant];
    race.updatedAt = Date.now();

    if (this.isActiveRace(race.id)) {
      this.emitRaceUpdate();
    }

    return participant;
  }

  updateParticipant(
    raceId: string,
    participantId: string,
    options: UpdateParticipantOptions,
  ): Participant {
    const race = this.getRaceOrThrow(raceId);
    const idx = race.participants.findIndex((participant) => participant.id === participantId);
    if (idx === -1) {
      throw new NotFoundException('Участник не найден');
    }

    const existing = race.participants[idx];
    let newBib = existing.bib;
    if (options.bib !== undefined) {
      const parsed = Math.trunc(options.bib);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new BadRequestException('Стартовый номер должен быть положительным числом');
      }
      if (
        race.participants.some(
          (participant) => participant.id !== existing.id && participant.bib === parsed,
        )
      ) {
        throw new BadRequestException('Участник с таким номером уже существует');
      }
      newBib = parsed;
    }

    let newCategoryId = existing.categoryId;
    if (options.categoryId !== undefined) {
      if (options.categoryId === null || options.categoryId === '') {
        newCategoryId = undefined;
      } else {
        this.ensureCategoryExists(race, options.categoryId);
        newCategoryId = options.categoryId;
      }
    }

    const updated: Participant = {
      ...existing,
      bib: newBib,
      name: options.name?.trim() || existing.name,
      categoryId: newCategoryId,
      team:
        options.team === undefined
          ? existing.team
          : options.team?.trim() || undefined,
    };

    race.participants = [
      ...race.participants.slice(0, idx),
      updated,
      ...race.participants.slice(idx + 1),
    ];
    race.updatedAt = Date.now();

    if (this.isActiveRace(race.id)) {
      this.updateTapEventsParticipant(race.id, existing, updated);
      this.emitRaceUpdate();
    }

    return updated;
  }

  recordTap(bib: number, source: TapEvent['source'] = 'manual'): TapEvent {
    if (!Number.isFinite(bib)) {
      throw new BadRequestException('Некорректный номер гонщика');
    }

    const race = this.getActiveRaceOrThrow();
    const participant = race.participants.find((item) => item.bib === bib);
    if (!participant) {
      throw new NotFoundException('Гонщик с таким номером не найден');
    }

    const tap: TapEvent = {
      id: this.createId(),
      bib: participant.bib,
      name: participant.name,
      categoryId: participant.categoryId,
      category: this.resolveCategoryName(race, participant.categoryId),
      timestamp: Date.now(),
      source,
    };

    const existing = this.tapEventsByRace.get(race.id) ?? [];
    this.tapEventsByRace.set(race.id, [tap, ...existing].slice(0, MAX_TAP_HISTORY));

    this.emit({ type: 'tap-recorded', payload: tap });
    return tap;
  }

  cancelTap(eventId: string): void {
    const race = this.getActiveRaceOrThrow();
    const existing = this.tapEventsByRace.get(race.id) ?? [];
    const next = existing.filter((event) => event.id !== eventId);

    if (next.length === existing.length) {
      throw new NotFoundException('Отметка не найдена');
    }

    this.tapEventsByRace.set(race.id, next);
    this.emit({ type: 'tap-cancelled', payload: { eventId } });
  }

  subscribe(listener: (event: RaceBroadcastEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getRaceOrThrow(raceId: string): Race {
    const race = this.races.get(raceId);
    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }
    return race;
  }

  private getActiveRace(): Race | undefined {
    if (!this.activeRaceId) {
      return undefined;
    }
    return this.races.get(this.activeRaceId);
  }

  private getActiveRaceOrThrow(): Race {
    const race = this.getActiveRace();
    if (!race) {
      throw new NotFoundException('Активная гонка не выбрана');
    }
    return race;
  }

  private isActiveRace(raceId: string): boolean {
    return this.activeRaceId === raceId;
  }

  private resolveCategoryName(race: Race, categoryId?: string): string {
    if (!categoryId) {
      return 'Без категории';
    }
    const category = race.categories.find((item) => item.id === categoryId);
    return category?.name ?? 'Без категории';
  }

  private toRider(race: Race, participant: Participant): Rider {
    return {
      bib: participant.bib,
      name: participant.name,
      categoryId: participant.categoryId,
      category: this.resolveCategoryName(race, participant.categoryId),
    };
  }

  private ensureCategoryExists(race: Race, categoryId: string) {
    const exists = race.categories.some((category) => category.id === categoryId);
    if (!exists) {
      throw new NotFoundException('Категория не найдена');
    }
  }

  private updateTapEventsCategoryName(raceId: string, categoryId: string, name: string) {
    const events = this.tapEventsByRace.get(raceId);
    if (!events) {
      return;
    }

    this.tapEventsByRace.set(
      raceId,
      events.map((event) =>
        event.categoryId === categoryId ? { ...event, category: name } : event,
      ),
    );
  }

  private updateTapEventsParticipant(
    raceId: string,
    previous: Participant,
    nextParticipant: Participant,
  ) {
    const events = this.tapEventsByRace.get(raceId);
    if (!events) {
      return;
    }

    this.tapEventsByRace.set(
      raceId,
      events.map((event) =>
        event.bib === previous.bib
          ? {
              ...event,
              bib: nextParticipant.bib,
              name: nextParticipant.name,
              categoryId: nextParticipant.categoryId,
              category: this.resolveCategoryName(
                this.getRaceOrThrow(raceId),
                nextParticipant.categoryId,
              ),
            }
          : event,
      ),
    );
  }

  private emitRaceUpdate() {
    const state = this.getState();
    this.emit({ type: 'race-updated', payload: state });
  }

  private emit(event: RaceBroadcastEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private createId(): string {
    const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (webCrypto?.randomUUID) {
      return webCrypto.randomUUID();
    }

    return randomUUID();
  }
}
