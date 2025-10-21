import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserEntity, UserRole } from './users.types';

@Injectable()
export class UsersService {
  private readonly adminIds: Set<number>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const raw = this.configService.get<string>('TELEGRAM_ADMIN_IDS');
    this.adminIds = new Set(
      (raw ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value)),
    );
  }

  async findByTelegramId(telegramId: number): Promise<UserEntity | undefined> {
    const record = await this.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) as any } });
    return record ? this.toEntity(record) : undefined;
  }

  async upsertFromTelegram(payload: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
  }): Promise<UserEntity> {
    const role: UserRole = this.adminIds.has(payload.telegramId)
      ? 'admin'
      : 'viewer';

    const record = await this.prisma.user.upsert({
      where: { telegramId: BigInt(payload.telegramId) as any },
      update: {
        username: payload.username ?? undefined,
        firstName: payload.firstName ?? undefined,
        lastName: payload.lastName ?? undefined,
        photoUrl: payload.photoUrl ?? undefined,
      },
      create: {
        telegramId: BigInt(payload.telegramId) as any,
        username: payload.username,
        firstName: payload.firstName,
        lastName: payload.lastName,
        photoUrl: payload.photoUrl,
        role,
      },
    });

    return this.toEntity(record);
  }

  async findAll(): Promise<UserEntity[]> {
    const records = await this.prisma.user.findMany({
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
        { username: 'asc' },
      ],
    });

    return records.map((record) => this.toEntity(record));
  }

  async promoteToAdmin(identifier: { telegramId?: number; username?: string }): Promise<UserEntity> {
    if (!identifier.telegramId && !identifier.username) {
      throw new BadRequestException('Укажите Telegram ID или username');
    }

    const record = await this.prisma.user.findFirst({
      where: {
        OR: [
          identifier.telegramId ? { telegramId: BigInt(identifier.telegramId) as any } : undefined,
          identifier.username ? { username: identifier.username } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!record) {
      throw new NotFoundException('Пользователь не найден');
    }

    const updated = await this.prisma.user.update({
      where: { id: record.id },
      data: { role: 'admin' },
    });

    return this.toEntity(updated);
  }

  private toEntity(record: {
    id: string;
    telegramId: bigint | number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    role: UserRole;
    createdAt: Date;
  }): UserEntity {
    const telegramId = typeof record.telegramId === 'bigint' ? Number(record.telegramId) : record.telegramId;
    return {
      id: record.id,
      telegramId,
      username: record.username ?? undefined,
      firstName: record.firstName ?? undefined,
      lastName: record.lastName ?? undefined,
      photoUrl: record.photoUrl ?? undefined,
      role: record.role,
      createdAt: record.createdAt,
    } satisfies UserEntity;
  }
}
