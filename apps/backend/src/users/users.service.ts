import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { UserEntity, UserRole } from './users.types';

@Injectable()
export class UsersService {
  private readonly users = new Map<number, UserEntity>();
  private readonly adminIds: Set<number>;

  constructor(private readonly configService: ConfigService) {
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

  findByTelegramId(telegramId: number): UserEntity | undefined {
    return this.users.get(telegramId);
  }

  upsertFromTelegram(payload: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
  }): UserEntity {
    const existing = this.users.get(payload.telegramId);

    if (existing) {
      const updated = {
        ...existing,
        username: payload.username ?? existing.username,
        firstName: payload.firstName ?? existing.firstName,
        lastName: payload.lastName ?? existing.lastName,
        photoUrl: payload.photoUrl ?? existing.photoUrl,
      } satisfies UserEntity;
      this.users.set(payload.telegramId, updated);
      return updated;
    }

    const role: UserRole = this.adminIds.has(payload.telegramId)
      ? 'admin'
      : 'viewer';

    const user: UserEntity = {
      id: randomUUID(),
      telegramId: payload.telegramId,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      photoUrl: payload.photoUrl,
      role,
      createdAt: new Date(),
    };

    this.users.set(payload.telegramId, user);
    return user;
  }
}
