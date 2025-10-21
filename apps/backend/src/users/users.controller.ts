import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listUsers() {
    const users = await this.usersService.findAll();
    return { users };
  }

  @Post('admins')
  @UseGuards(JwtAuthGuard)
  async addAdmin(
    @Body() body: { telegramId?: number; username?: string },
    @Req() req: Request & { user: { role: string } },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Требуются права администратора');
    }

    const telegramId = body.telegramId ? Number(body.telegramId) : undefined;
    const username = body.username?.replace(/^@/, '')?.trim();

    if (!telegramId && !username) {
      throw new BadRequestException('Укажите Telegram ID или username');
    }

    const admin = await this.usersService.promoteToAdmin({ telegramId, username });
    return { admin };
  }
}
