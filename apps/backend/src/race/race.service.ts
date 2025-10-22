import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import { PrismaService } from '../prisma/prisma.service';
import {
  extractParticipantRows,
  parseDateValue,
} from './xlsx-parser';

type CreateRaceOptions = {
  name: string;
  totalLaps: number;
  slug?: string | null;
  tapCooldownSeconds?: number;
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
  birthDate?: Date | null;
};

type UpdateParticipantOptions = {
  bib?: number;
  name?: string;
  categoryId?: string | null;
  team?: string | null;
  birthDate?: Date | null;
};

@Injectable()
export class RaceService {
  private readonly logger = new Logger(RaceService.name);
  private readonly listeners = new Set<(event: RaceBroadcastEvent) => void>();
  private readonly raceModel: any;

  constructor(private readonly prisma: PrismaService) {
    this.raceModel = prisma.race;
  }

  async getRaces(): Promise<Race[]> {
    const races = await this.raceModel.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        categories: { orderBy: { order: 'asc' } },
        participants: { orderBy: { bib: 'asc' } },
      },
    });
    const participantIds = races.flatMap((race) =>
      race.participants.map((participant) => participant.id),
    );
    const issuedIds = await this.getIssuedParticipantIds(participantIds);

    return races.map((race) => this.toRace(race, issuedIds));
  }

  async getRaceById(raceId: string): Promise<Race> {
    const race = await this.raceModel.findUnique({
      where: { id: raceId },
      include: {
        categories: { orderBy: { order: 'asc' } },
        participants: { orderBy: { bib: 'asc' } },
      },
    });

    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }
    const issuedIds = await this.getIssuedParticipantIds(
      race.participants.map((participant) => participant.id),
    );

    return this.toRace(race, issuedIds);
  }

  async getRaceBySlug(slug: string): Promise<Race> {
    const race = await this.raceModel.findUnique({
      where: { slug },
      include: {
        categories: { orderBy: { order: 'asc' } },
        participants: { orderBy: { bib: 'asc' } },
      },
    });

    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    const issuedIds = await this.getIssuedParticipantIds(
      race.participants.map((participant) => participant.id),
    );

    return this.toRace(race, issuedIds);
  }

  async getPublicRaceSummaries(): Promise<
    Array<{
      id: string;
      slug: string | null;
      name: string;
      totalLaps: number;
      tapCooldownSeconds: number;
      startedAt: number | null;
      createdAt: number;
      participants: number;
      categories: number;
    }>
  > {
    const races = await this.raceModel.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        totalLaps: true,
        tapCooldownSeconds: true,
        startedAt: true,
        createdAt: true,
        participants: { select: { id: true } },
        categories: { select: { id: true } },
      },
    });

    return races.map((race) => ({
      id: race.id,
      slug: race.slug,
      name: race.name,
      totalLaps: race.totalLaps,
      tapCooldownSeconds: race.tapCooldownSeconds,
      startedAt: race.startedAt ? race.startedAt.getTime() : null,
      createdAt: race.createdAt.getTime(),
      participants: race.participants.length,
      categories: race.categories.length,
    }));
  }

  async updateRace(
    raceId: string,
    options: {
      name?: string;
      totalLaps?: number;
      tapCooldownSeconds?: number;
      slug?: string | null;
      startedAt?: string | null;
    },
  ): Promise<Race> {
    const race = await this.raceModel.findUnique({
      where: { id: raceId },
      include: {
        categories: true,
        participants: true,
      },
    });

    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    const data: {
      name?: string;
      totalLaps?: number;
      tapCooldownSeconds?: number;
      slug?: string | null;
      startedAt?: Date | null;
    } = {};

    if (options.name !== undefined) {
      const trimmed = options.name.trim();
      if (!trimmed) {
        throw new BadRequestException('Название гонки обязательно');
      }
      data.name = trimmed;
    }

    if (options.totalLaps !== undefined) {
      if (!Number.isFinite(options.totalLaps) || options.totalLaps <= 0) {
        throw new BadRequestException('Количество кругов должно быть больше нуля');
      }
      data.totalLaps = Math.trunc(options.totalLaps);
    }

    if (options.tapCooldownSeconds !== undefined) {
      if (!Number.isFinite(options.tapCooldownSeconds) || options.tapCooldownSeconds < 0) {
        throw new BadRequestException('Кулдаун отметок должен быть неотрицательным');
      }
      data.tapCooldownSeconds = Math.trunc(options.tapCooldownSeconds);
    }

    if (options.slug !== undefined) {
      if (options.slug === null) {
        data.slug = null;
      } else {
        const raw = options.slug.trim();
        if (!raw) {
          data.slug = null;
        } else {
          const normalized = this.normalizeSlug(raw);
          if (!normalized) {
            throw new BadRequestException('Слаг не может быть пустым');
          }
          data.slug = await this.ensureUniqueSlug(normalized, raceId);
        }
      }
    }

    if (options.startedAt !== undefined) {
      if (options.startedAt === null) {
        data.startedAt = null;
      } else {
        const parsed = new Date(options.startedAt);
        if (!Number.isFinite(parsed.getTime())) {
          throw new BadRequestException('Некорректное время старта гонки');
        }
        data.startedAt = parsed;
      }
    }

    if (Object.keys(data).length === 0) {
      return this.toRace(race);
    }

    const updated = await this.raceModel.update({
      where: { id: raceId },
      data,
      include: {
        categories: true,
        participants: true,
      },
    });

    await this.emitRaceUpdate(raceId);
    const issuedIds = await this.getIssuedParticipantIds(
      updated.participants.map((participant) => participant.id),
    );
    return this.toRace(updated, issuedIds);
  }

  async getStateForRace(raceId: string): Promise<RaceStatePayload> {
    const race = await this.raceModel.findUnique({
      where: { id: raceId },
      include: {
        categories: { orderBy: { order: 'asc' } },
        participants: { orderBy: { bib: 'asc' } },
      },
    });
    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    const tapEvents = await this.prisma.tapEvent.findMany({
      where: { raceId },
      orderBy: { timestamp: 'desc' },
    });

    const issuedIds = await this.getIssuedParticipantIds(
      race.participants.map((participant) => participant.id),
    );

    const categories = race.categories.map((category) =>
      this.toCategory(category),
    );
    const issuedParticipants = race.participants.filter((participant) =>
      issuedIds.has(participant.id),
    );
    const riders: Rider[] = issuedParticipants.map((participant) => ({
      bib: participant.bib,
      name: participant.name,
      categoryId: participant.categoryId ?? undefined,
      category: this.resolveCategoryName(categories, participant.categoryId),
    }));

    return {
      race: {
        id: race.id,
        slug: race.slug ?? null,
        name: race.name,
        totalLaps: race.totalLaps,
        tapCooldownSeconds: race.tapCooldownSeconds,
        startedAt: race.startedAt ? race.startedAt.getTime() : null,
      },
      categories,
      riders,
      tapEvents: tapEvents.map((event) => this.toTapEvent(event)),
    } satisfies RaceStatePayload;
  }

  async getStateForRaceSlug(slug: string): Promise<RaceStatePayload> {
    const normalized = this.normalizeSlug(slug);
    if (!normalized) {
      throw new NotFoundException('Гонка не найдена');
    }

    const race = await this.raceModel.findUnique({
      where: { slug: normalized },
      select: { id: true },
    });

    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    return this.getStateForRace(race.id);
  }

  async getLapsRemainingForRace(raceId: string) {
    const state = await this.getStateForRace(raceId);

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
    const lapsRemaining = Math.max((state.race?.totalLaps ?? 0) - leaderLaps, 0);

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

  async createRace(options: CreateRaceOptions): Promise<Race> {
    if (!options.name?.trim()) {
      throw new BadRequestException('Название гонки обязательно');
    }
    if (!Number.isFinite(options.totalLaps) || options.totalLaps <= 0) {
      throw new BadRequestException('Количество кругов должно быть больше нуля');
    }

    const tapCooldownSeconds = options.tapCooldownSeconds ?? 0;
    if (!Number.isFinite(tapCooldownSeconds) || tapCooldownSeconds < 0) {
      throw new BadRequestException('Кулдаун отметок должен быть неотрицательным');
    }

    let slug: string | null = null;
    if (options.slug !== undefined && options.slug !== null) {
      const raw = options.slug.trim();
      if (raw) {
        const normalized = this.normalizeSlug(raw);
        if (!normalized) {
          throw new BadRequestException('Слаг не может быть пустым');
        }
        slug = await this.ensureUniqueSlug(normalized);
      }
    }

    if (!slug) {
      const fromName = this.normalizeSlug(options.name);
      const base = fromName || `race-${randomUUID().slice(0, 8)}`;
      slug = await this.ensureUniqueSlug(base);
    }

    const race = await this.raceModel.create({
      data: {
        name: options.name.trim(),
        totalLaps: Math.trunc(options.totalLaps),
        slug,
        tapCooldownSeconds: Math.trunc(tapCooldownSeconds),
      },
      include: {
        categories: true,
        participants: true,
      },
    });

    await this.emitRaceUpdate(race.id);
    return this.toRace(race);
  }

  async addCategory(raceId: string, options: CreateCategoryOptions): Promise<Category> {
    if (!options.name?.trim()) {
      throw new BadRequestException('Имя категории обязательно');
    }

    const maxOrder = await this.prisma.category.aggregate({
      where: { raceId },
      _max: { order: true },
    });

    const category = await this.prisma.category.create({
      data: {
        raceId,
        name: options.name.trim(),
        description: options.description?.trim() || undefined,
        order: options.order ?? (maxOrder._max.order ?? -1) + 1,
      },
    });

    await this.emitRaceUpdate(raceId);
    return this.toCategory(category);
  }

  async updateCategory(
    raceId: string,
    categoryId: string,
    options: UpdateCategoryOptions,
  ): Promise<Category> {
    const existing = await this.ensureCategoryExists(raceId, categoryId);

    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: options.name?.trim() || existing.name,
        description:
          options.description === undefined
            ? existing.description
            : options.description.trim() || undefined,
        order: options.order ?? existing.order,
      },
    });

    await this.prisma.tapEvent.updateMany({
      where: { raceId, categoryId },
      data: { categoryName: updated.name },
    });

    await this.emitRaceUpdate(raceId);
    return this.toCategory(updated);
  }

  async removeCategory(raceId: string, categoryId: string): Promise<Category> {
    const category = await this.ensureCategoryExists(raceId, categoryId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tapEvent.updateMany({
        where: { raceId, categoryId },
        data: {
          categoryId: null,
          categoryName: 'Без категории',
        },
      });

      await tx.participant.updateMany({
        where: { raceId, categoryId },
        data: { categoryId: null },
      });

      await tx.category.delete({
        where: { id: categoryId },
      });
    });

    await this.emitRaceUpdate(raceId);
    return this.toCategory(category);
  }

  async addParticipant(
    raceId: string,
    options: CreateParticipantOptions,
  ): Promise<Participant> {
    const bib = Math.trunc(options.bib);
    if (!Number.isFinite(bib) || bib <= 0) {
      throw new BadRequestException('Стартовый номер должен быть положительным числом');
    }

    if (!options.name?.trim()) {
      throw new BadRequestException('Имя участника обязательно');
    }

    if (options.categoryId) {
      await this.ensureCategoryExists(raceId, options.categoryId);
    }

    try {
      const participant = await this.prisma.participant.create({
        data: {
          raceId,
          bib,
          name: options.name.trim(),
          categoryId: options.categoryId ?? null,
          team: options.team?.trim() || undefined,
          birthDate: options.birthDate ?? null,
        },
      });

      await this.emitRaceUpdate(raceId);
      return this.toParticipant(participant, undefined, false);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Участник с таким номером уже существует');
      }
      throw error;
    }
  }

  async updateParticipant(
    raceId: string,
    participantId: string,
    options: UpdateParticipantOptions,
  ): Promise<Participant> {
    const participant = await this.prisma.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.raceId !== raceId) {
      throw new NotFoundException('Участник не найден');
    }

    let newBib = participant.bib;
    if (options.bib !== undefined) {
      const parsed = Math.trunc(options.bib);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new BadRequestException('Стартовый номер должен быть положительным числом');
      }

      const conflict = await this.prisma.participant.findFirst({
        where: {
          raceId,
          bib: parsed,
          NOT: { id: participantId },
        },
      });
      if (conflict) {
        throw new BadRequestException('Участник с таким номером уже существует');
      }
      newBib = parsed;
    }

    let newCategoryId = participant.categoryId;
    if (options.categoryId !== undefined) {
      if (!options.categoryId) {
        newCategoryId = null;
      } else {
        await this.ensureCategoryExists(raceId, options.categoryId);
        newCategoryId = options.categoryId;
      }
    }

    let newBirthDate = participant.birthDate;
    if (options.birthDate !== undefined) {
      newBirthDate = options.birthDate ?? null;
    }

    const updated = await this.prisma.participant.update({
      where: { id: participantId },
      data: {
        bib: newBib,
        name: options.name?.trim() || participant.name,
        categoryId: newCategoryId,
        team:
          options.team === undefined
            ? participant.team
            : options.team?.trim() || undefined,
        birthDate: newBirthDate,
      },
      include: { category: true },
    });

    await this.prisma.tapEvent.updateMany({
      where: { raceId, participantId },
      data: {
        bib: updated.bib,
        name: updated.name,
        categoryId: updated.categoryId,
        categoryName: updated.category?.name ?? 'Без категории',
      },
    });

    await this.emitRaceUpdate(raceId);
    const isIssued = await this.isParticipantIssued(participantId);
    return this.toParticipant(updated, undefined, isIssued);
  }

  async setParticipantIssued(
    raceId: string,
    participantId: string,
    isIssued: boolean,
  ): Promise<Participant> {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant || participant.raceId !== raceId) {
      throw new NotFoundException('Участник не найден');
    }

    const alreadyIssued = await this.isParticipantIssued(participantId);
    if (alreadyIssued === isIssued) {
      this.logger.debug(
        `Bib status unchanged for participant ${participantId} (race ${raceId}), already ${alreadyIssued ? 'issued' : 'not issued'}.`,
      );
      return this.toParticipant(participant, undefined, alreadyIssued);
    }

    this.logger.debug(
      `Updating bib status for participant ${participantId} in race ${raceId}: ${alreadyIssued ? 'issued -> not issued' : 'not issued -> issued'}.`,
    );

    await this.prisma.$transaction(async (tx) => {
      if (isIssued) {
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO "ParticipantIssue" ("participantId")
            VALUES (${participantId})
            ON CONFLICT ("participantId") DO NOTHING
          `,
        );
      } else {
        await tx.tapEvent.deleteMany({ where: { raceId, participantId } });
        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "ParticipantIssue"
            WHERE "participantId" = ${participantId}
          `,
        );
      }

      await tx.participant.update({
        where: { id: participantId },
        data: { updatedAt: new Date() },
      });

      await tx.race.update({
        where: { id: raceId },
        data: { updatedAt: new Date() },
      });
    });

    const afterIssued = await this.isParticipantIssued(participantId);
    this.logger.debug(
      `Participant ${participantId} issue status after update: ${afterIssued}.`,
    );

    await this.emitRaceUpdate(raceId);
    return this.toParticipant(participant, undefined, isIssued);
  }

  async removeParticipants(raceId: string, participantIds: string[]): Promise<{
    removed: Participant[];
  }> {
    const uniqueIds = [...new Set(participantIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Не переданы участники для удаления');
    }

    const participants = await this.prisma.participant.findMany({
      where: {
        raceId,
        id: { in: uniqueIds },
      },
    });

    if (participants.length === 0) {
      return { removed: [] };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tapEvent.deleteMany({
        where: {
          raceId,
          participantId: { in: participants.map((participant) => participant.id) },
        },
      });

      await tx.participant.deleteMany({
        where: {
          raceId,
          id: { in: participants.map((participant) => participant.id) },
        },
      });
    });

    await this.emitRaceUpdate(raceId);

    return {
      removed: participants.map((participant) =>
        this.toParticipant(participant, undefined, false),
      ),
    };
  }

  async deleteRace(raceId: string): Promise<void> {
    const race = await this.raceModel.findUnique({
      where: { id: raceId },
    });

    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    await this.raceModel.delete({ where: { id: raceId } });

    this.emit({
      type: 'race-updated',
      raceId,
      payload: {
        race: null,
        categories: [],
        riders: [],
        tapEvents: [],
      },
    });
  }

  async importParticipantsFromXlsx(
    raceId: string,
    fileBuffer: Buffer,
  ) {
    if (!fileBuffer?.length) {
      throw new BadRequestException('Файл импорта пуст');
    }

    let rows;
    try {
      rows = extractParticipantRows(fileBuffer);
    } catch (error) {
      throw new BadRequestException('Не удалось прочитать XLSX-файл');
    }

    if (!rows.length) {
      throw new BadRequestException('В файле не найдено ни одной записи');
    }

    const processed: Array<{
      rowIndex: number;
      bib: number;
      name: string;
      categoryName?: string | null;
      team?: string;
      birthDate?: Date | null;
    }> = [];
    const skipped: Array<{ rowIndex: number; reason: string }> = [];
    const categoryNames = new Set<string>();
    const seenBibs = new Set<number>();

    for (const row of rows) {
      const bibRaw = getValue(row.data, BIB_HEADERS);
      const bib = parseBib(bibRaw);
      if (!bib) {
        skipped.push({ rowIndex: row.rowIndex, reason: 'Некорректный стартовый номер' });
        continue;
      }

      if (seenBibs.has(bib)) {
        skipped.push({ rowIndex: row.rowIndex, reason: 'Повторяющийся стартовый номер' });
        continue;
      }
      seenBibs.add(bib);

      const firstName = getValue(row.data, FIRST_NAME_HEADERS);
      const lastName = getValue(row.data, LAST_NAME_HEADERS);
      const middleName = getValue(row.data, MIDDLE_NAME_HEADERS);

      const fullName = buildFullName(firstName, middleName, lastName);
      if (!fullName) {
        skipped.push({ rowIndex: row.rowIndex, reason: 'Не указано имя участника' });
        continue;
      }

      const genderRaw = getValue(row.data, GENDER_HEADERS);
      const distanceRaw = getValue(row.data, DISTANCE_HEADERS);
      const categoryName = buildCategoryName(distanceRaw, genderRaw);
      if (categoryName) {
        categoryNames.add(categoryName);
      }

      const team = getValue(row.data, TEAM_HEADERS).trim();
      const birthDateRaw = getValue(row.data, BIRTH_DATE_HEADERS);
      const birthDate = birthDateRaw ? parseDateValue(birthDateRaw) : null;

      processed.push({
        rowIndex: row.rowIndex,
        bib,
        name: fullName,
        categoryName,
        team: team || undefined,
        birthDate,
      });
    }

    if (!processed.length) {
      return {
        created: [] as Participant[],
        updated: [] as Participant[],
        categoriesCreated: [] as Category[],
        skipped,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existingCategories = await tx.category.findMany({
        where: { raceId },
        orderBy: { order: 'asc' },
      });
      const existingCategoryMap = new Map<string, typeof existingCategories[number]>();
      for (const category of existingCategories) {
        existingCategoryMap.set(normalizeCategoryKey(category.name), category);
      }

      let maxOrder =
        existingCategories.reduce((acc, category) => Math.max(acc, category.order), -1) ?? -1;

      const categoriesCreated: typeof existingCategories = [];

      for (const name of categoryNames) {
        const key = normalizeCategoryKey(name);
        if (!existingCategoryMap.has(key)) {
          maxOrder += 1;
          const created = await tx.category.create({
            data: {
              raceId,
              name,
              order: maxOrder,
            },
          });
          existingCategoryMap.set(key, created);
          categoriesCreated.push(created);
        }
      }

      const existingParticipants = await tx.participant.findMany({
        where: { raceId },
      });
      const participantsByBib = new Map<number, typeof existingParticipants[number]>();
      for (const participant of existingParticipants) {
        participantsByBib.set(participant.bib, participant);
      }

      const created: typeof existingParticipants = [];
      const updated: typeof existingParticipants = [];

      for (const row of processed) {
        const category = row.categoryName
          ? existingCategoryMap.get(normalizeCategoryKey(row.categoryName))
          : undefined;
        const categoryId = category?.id ?? null;

        const existing = participantsByBib.get(row.bib);
        if (existing) {
          const updatedParticipant = await tx.participant.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              categoryId,
              team: row.team ?? null,
              birthDate: row.birthDate ?? null,
            },
          });
          await tx.tapEvent.updateMany({
            where: { raceId, participantId: existing.id },
            data: {
              bib: updatedParticipant.bib,
              name: updatedParticipant.name,
              categoryId,
              categoryName: category?.name ?? 'Без категории',
            },
          });
          updated.push(updatedParticipant);
        } else {
          const createdParticipant = await tx.participant.create({
            data: {
              raceId,
              bib: row.bib,
              name: row.name,
              categoryId,
              team: row.team ?? null,
              birthDate: row.birthDate ?? null,
            },
          });
          participantsByBib.set(row.bib, createdParticipant);
          created.push(createdParticipant);
        }
      }

      return {
        created,
        updated,
        categoriesCreated,
      };
    });

    await this.emitRaceUpdate(raceId);

    const issuedForUpdated = await this.getIssuedParticipantIds(
      result.updated.map((participant) => participant.id),
    );

    return {
      created: result.created.map((participant) =>
        this.toParticipant(participant, undefined, false),
      ),
      updated: result.updated.map((participant) =>
        this.toParticipant(participant, issuedForUpdated),
      ),
      categoriesCreated: result.categoriesCreated.map((category) => this.toCategory(category)),
      skipped,
    };
  }

  async recordTap(
    raceId: string,
    bib: number,
    source: TapEvent['source'] = 'manual',
  ): Promise<TapEvent> {
    if (!Number.isFinite(bib)) {
      throw new BadRequestException('Некорректный номер гонщика');
    }

    const participant = await this.prisma.participant.findFirst({
      where: { raceId, bib },
      include: { category: true },
    });
    if (!participant) {
      throw new NotFoundException('Гонщик с таким номером не найден');
    }
    const isIssued = await this.isParticipantIssued(participant.id);
    if (!isIssued) {
      throw new BadRequestException('Для этого гонщика номер ещё не выдан');
    }

    const eventRecord = await this.prisma.tapEvent.create({
      data: {
        raceId,
        participantId: participant.id,
        categoryId: participant.categoryId,
        categoryName: participant.category?.name ?? 'Без категории',
        bib: participant.bib,
        name: participant.name,
        source: source === 'system' ? 'system' : 'manual',
      },
    });

    await this.raceModel.update({
      where: { id: raceId },
      data: { updatedAt: new Date() },
    });

    const event = this.toTapEvent(eventRecord);
    this.emit({ type: 'tap-recorded', raceId, payload: event });
    await this.emitRaceUpdate(raceId);
    return event;
  }

  async cancelTap(raceId: string, eventId: string): Promise<void> {
    const event = await this.prisma.tapEvent.findUnique({ where: { id: eventId } });
    if (!event || event.raceId !== raceId) {
      throw new NotFoundException('Отметка не найдена');
    }

    await this.prisma.tapEvent.delete({ where: { id: eventId } });
    this.emit({ type: 'tap-cancelled', raceId, payload: { eventId } });
    await this.emitRaceUpdate(raceId);
  }

  async startRace(raceId: string): Promise<Race> {
    const race = await this.raceModel.findUnique({ where: { id: raceId } });
    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    if (race.startedAt) {
      const withRelations = await this.raceModel.findUnique({
        where: { id: raceId },
        include: {
          categories: true,
          participants: true,
        },
      });
      if (!withRelations) {
        throw new NotFoundException('Гонка не найдена');
      }
      return this.toRace(withRelations);
    }

    const updated = await this.raceModel.update({
      where: { id: raceId },
      data: { startedAt: new Date() },
      include: {
        categories: true,
        participants: true,
      },
    });

    await this.emitRaceUpdate(raceId);
    return this.toRace(updated);
  }

  async stopRace(raceId: string): Promise<Race> {
    const race = await this.raceModel.findUnique({ where: { id: raceId } });
    if (!race) {
      throw new NotFoundException('Гонка не найдена');
    }

    if (!race.startedAt) {
      const withRelations = await this.raceModel.findUnique({
        where: { id: raceId },
        include: {
          categories: true,
          participants: true,
        },
      });
      if (!withRelations) {
        throw new NotFoundException('Гонка не найдена');
      }
      return this.toRace(withRelations);
    }

    const updated = await this.raceModel.update({
      where: { id: raceId },
      data: { startedAt: null },
      include: {
        categories: true,
        participants: true,
      },
    });

    await this.emitRaceUpdate(raceId);
    return this.toRace(updated);
  }

  subscribe(listener: (event: RaceBroadcastEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async ensureCategoryExists(raceId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.raceId !== raceId) {
      throw new NotFoundException('Категория не найдена');
    }
    return category;
  }

  private resolveCategoryName(categories: Category[], categoryId?: string | null) {
    if (!categoryId) {
      return 'Без категории';
    }
    const match = categories.find((category) => category.id === categoryId);
    return match?.name ?? 'Без категории';
  }

  private normalizeSlug(input?: string | null): string {
    if (!input) {
      return '';
    }

    const normalized = input
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized;
  }

  private async ensureUniqueSlug(base: string, ignoreRaceId?: string): Promise<string> {
    let cleaned = base || `race-${randomUUID().slice(0, 8)}`;
    cleaned = cleaned.replace(/^-+|-+$/g, '').slice(0, 60);
    if (!cleaned) {
      cleaned = `race-${randomUUID().slice(0, 8)}`;
    }

    let candidate = cleaned;
    let attempt = 1;

    while (true) {
      const existing = await this.raceModel.findFirst({
        where: {
          slug: candidate,
          ...(ignoreRaceId ? { NOT: { id: ignoreRaceId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      attempt += 1;
      const suffix = `-${attempt}`;
      const maxLength = 60;
      const trimmedBase = cleaned.slice(0, Math.max(1, maxLength - suffix.length));
      candidate = `${trimmedBase}${suffix}`;
    }
  }

  private toCategory(category: {
    id: string;
    name: string;
    description: string | null;
    order: number;
  }): Category {
    return {
      id: category.id,
      name: category.name,
      description: category.description ?? undefined,
      order: category.order,
    } satisfies Category;
  }

  private toParticipant(
    participant: {
      id: string;
      bib: number;
      name: string;
      categoryId: string | null;
      team: string | null;
      birthDate: Date | null;
    },
    issuedIds?: Set<string>,
    forced?: boolean,
  ): Participant {
    const isBibIssued =
      forced ?? (issuedIds ? issuedIds.has(participant.id) : false);
    return {
      id: participant.id,
      bib: participant.bib,
      name: participant.name,
      categoryId: participant.categoryId ?? undefined,
      team: participant.team ?? undefined,
      birthDate: participant.birthDate ? participant.birthDate.getTime() : null,
      isBibIssued,
    } satisfies Participant;
  }

  private toTapEvent(event: {
    id: string;
    bib: number;
    name: string;
    categoryId: string | null;
    categoryName: string;
    timestamp: Date;
    source: 'manual' | 'system';
  }): TapEvent {
    return {
      id: event.id,
      bib: event.bib,
      name: event.name,
      category: event.categoryName,
      categoryId: event.categoryId ?? undefined,
      timestamp: event.timestamp.getTime(),
      source: event.source,
    } satisfies TapEvent;
  }

  private toRace(
    race: {
    id: string;
    name: string;
    totalLaps: number;
    slug?: string | null;
    tapCooldownSeconds: number;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    categories: {
      id: string;
      name: string;
      description: string | null;
      order: number;
    }[];
    participants: {
      id: string;
      bib: number;
      name: string;
      categoryId: string | null;
      team: string | null;
      birthDate: Date | null;
    }[];
  },
    issuedIds?: Set<string>,
  ): Race {
    const categories = [...race.categories].sort((a, b) => a.order - b.order);
    const participants = [...race.participants].sort((a, b) => a.bib - b.bib);

    return {
      id: race.id,
      name: race.name,
      slug: race.slug ?? null,
      totalLaps: race.totalLaps,
      tapCooldownSeconds: race.tapCooldownSeconds,
      createdAt: race.createdAt.getTime(),
      updatedAt: race.updatedAt.getTime(),
      startedAt: race.startedAt ? race.startedAt.getTime() : null,
      categories: categories.map((category) => this.toCategory(category)),
      participants: participants.map((participant) =>
        this.toParticipant(participant, issuedIds),
      ),
    } satisfies Race;
  }

  private async getIssuedParticipantIds(participantIds: string[]): Promise<Set<string>> {
    if (participantIds.length === 0) {
      return new Set();
    }

    const rows = await this.prisma.$queryRaw<Array<{ participantId: string }>>(
      Prisma.sql`
        SELECT "participantId"
        FROM "ParticipantIssue"
        WHERE "participantId" IN (${Prisma.join(participantIds)})
      `,
    );

    return new Set(rows.map((row) => row.participantId));
  }

  private async isParticipantIssued(participantId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ participantId: string }>>(
      Prisma.sql`
        SELECT "participantId"
        FROM "ParticipantIssue"
        WHERE "participantId" = ${participantId}
        LIMIT 1
      `,
    );

    return rows.length > 0;
  }

  private emitRaceUpdate = async (raceId: string) => {
    const state = await this.getStateForRace(raceId);
    this.emit({ type: 'race-updated', raceId, payload: state });
  };

  private emit(event: RaceBroadcastEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    return (
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}

const BIB_HEADERS = ['номер', 'bib', 'start number', 'стартовый номер'];
const FIRST_NAME_HEADERS = ['имя', 'first name', 'firstname'];
const LAST_NAME_HEADERS = ['фамилия', 'last name', 'lastname'];
const MIDDLE_NAME_HEADERS = ['отчество', 'middle name', 'middlename'];
const DISTANCE_HEADERS = ['дистанция', 'distance', 'гонка', 'race'];
const GENDER_HEADERS = ['пол', 'gender'];
const TEAM_HEADERS = ['команда', 'team'];
const BIRTH_DATE_HEADERS = ['дата рождения', 'date of birth', 'birthdate'];

function getValue(record: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const normalisedKey = key.trim().toLowerCase();
    if (record[normalisedKey] !== undefined) {
      return record[normalisedKey];
    }
  }
  return '';
}

function parseBib(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function buildFullName(
  firstName: string,
  middleName: string,
  lastName: string,
): string {
  const parts = [firstName, middleName, lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.join(' ').trim();
}

function buildCategoryName(distanceRaw: string, genderRaw: string): string | null {
  const distance = distanceRaw?.trim();
  const gender = normalizeGender(genderRaw);

  if (distance && gender) {
    return `${distance} ${gender}`.trim();
  }
  if (distance) {
    return distance;
  }
  if (gender) {
    return gender;
  }
  return null;
}

function normalizeGender(value: string): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (['m', 'male', 'man', 'men', 'м'].includes(lower)) {
    return 'М';
  }
  if (['f', 'female', 'woman', 'women', 'ж'].includes(lower)) {
    return 'Ж';
  }
  return trimmed.toUpperCase();
}

function normalizeCategoryKey(name: string): string {
  return name.trim().toLowerCase();
}
