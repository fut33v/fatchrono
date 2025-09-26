import { Injectable } from '@nestjs/common';
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
    const record = await this.prisma.user.findUnique({ where: { telegramId } });
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
      where: { telegramId: payload.telegramId },
      update: {
        username: payload.username ?? undefined,
        firstName: payload.firstName ?? undefined,
        lastName: payload.lastName ?? undefined,
        photoUrl: payload.photoUrl ?? undefined,
      },
      create: {
        telegramId: payload.telegramId,
        username: payload.username,
        firstName: payload.firstName,
        lastName: payload.lastName,
        photoUrl: payload.photoUrl,
        role,
      },
    });

    return this.toEntity(record);
  }

  private toEntity(record: {
    id: string;
    telegramId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    role: UserRole;
    createdAt: Date;
  }): UserEntity {
    return {
      id: record.id,
      telegramId: record.telegramId,
      username: record.username ?? undefined,
      firstName: record.firstName ?? undefined,
      lastName: record.lastName ?? undefined,
      photoUrl: record.photoUrl ?? undefined,
      role: record.role,
      createdAt: record.createdAt,
    } satisfies UserEntity;
  }
}
