import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/users.types';
import { TelegramLoginDto } from './dto/telegram-login.dto';

const TELEGRAM_MAX_AUTH_AGE_SECONDS = 60;

@Injectable()
export class AuthService {
  private readonly botToken: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    this.botToken = token;
  }

  async loginWithTelegram(payload: TelegramLoginDto): Promise<{
    accessToken: string;
    user: UserEntity;
  }> {
    this.verifySignature(payload);
    this.ensureAuthDateIsFresh(payload);

    const user = this.usersService.upsertFromTelegram({
      telegramId: payload.id,
      username: payload.username,
      firstName: payload.first_name,
      lastName: payload.last_name,
      photoUrl: payload.photo_url,
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      telegramId: user.telegramId,
      role: user.role,
    });

    return { accessToken, user };
  }

  private ensureAuthDateIsFresh(payload: TelegramLoginDto) {
    const now = Math.floor(Date.now() / 1000);
    const age = now - payload.auth_date;
    if (age > TELEGRAM_MAX_AUTH_AGE_SECONDS) {
      throw new UnauthorizedException('Сессия Telegram устарела, попробуйте снова');
    }
  }

  private verifySignature(payload: TelegramLoginDto) {
    const { hash, ...rest } = payload;
    const dataCheckString = Object.entries(rest)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = createHash('sha256').update(this.botToken).digest();
    const signature = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (signature !== hash) {
      throw new UnauthorizedException('Неверная подпись Telegram');
    }
  }
}
