import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RaceService } from './race.service';
import { CreateRaceDto } from './dto/create-race.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { parseDateValue } from './xlsx-parser';
import type { Express } from 'express';
import { DeleteParticipantsDto } from './dto/delete-participants.dto';

@Controller('race')
export class RaceController {
  constructor(private readonly raceService: RaceService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listRaces() {
    return {
      races: await this.raceService.getRaces(),
    };
  }

  @Get('public')
  getPublicRaces() {
    return this.raceService.getPublicRaceSummaries();
  }

  @Patch(':raceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateRace(@Param('raceId') raceId: string, @Body() body: UpdateRaceDto) {
    const race = await this.raceService.updateRace(raceId, body);
    return { race };
  }

  @Get(':raceId/state')
  getStateByRace(@Param('raceId') raceId: string) {
    return this.raceService.getStateForRace(raceId);
  }

  @Get(':raceId/laps-remaining')
  getLapsRemainingByRace(@Param('raceId') raceId: string) {
    return this.raceService.getLapsRemainingForRace(raceId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createRace(@Body() body: CreateRaceDto) {
    const race = await this.raceService.createRace(body);
    return { race };
  }

  @Post(':raceId/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async addCategory(
    @Param('raceId') raceId: string,
    @Body() body: CreateCategoryDto,
  ) {
    const category = await this.raceService.addCategory(raceId, body);
    return { category };
  }

  @Patch(':raceId/categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateCategory(
    @Param('raceId') raceId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const category = await this.raceService.updateCategory(raceId, categoryId, body);
    return { category };
  }

  @Post(':raceId/participants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async addParticipant(
    @Param('raceId') raceId: string,
    @Body() body: CreateParticipantDto,
  ) {
    const birthDate = body.birthDate ? parseDateValue(body.birthDate) : null;
    if (body.birthDate && !birthDate) {
      throw new BadRequestException('Некорректная дата рождения');
    }

    const participant = await this.raceService.addParticipant(raceId, {
      bib: body.bib,
      name: body.name,
      categoryId: body.categoryId,
      team: body.team,
      birthDate,
    });
    return { participant };
  }

  @Patch(':raceId/participants/:participantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateParticipant(
    @Param('raceId') raceId: string,
    @Param('participantId') participantId: string,
    @Body() body: UpdateParticipantDto,
  ) {
    const participant = await this.raceService.updateParticipant(
      raceId,
      participantId,
      {
        bib: body.bib,
        name: body.name,
        categoryId: body.categoryId,
        team: body.team,
        birthDate:
          body.birthDate === undefined
            ? undefined
            : (() => {
                if (!body.birthDate) {
                  return null;
                }
                const date = parseDateValue(body.birthDate);
                if (!date) {
                  throw new BadRequestException('Некорректная дата рождения');
                }
                return date;
              })(),
      },
    );
    return { participant };
  }

  @Delete(':raceId/participants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteParticipants(
    @Param('raceId') raceId: string,
    @Body() body: DeleteParticipantsDto,
  ) {
    return this.raceService.removeParticipants(raceId, body.ids);
  }

  @Post(':raceId/participants/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async importParticipants(
    @Param('raceId') raceId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не найден');
    }

    return this.raceService.importParticipantsFromXlsx(raceId, file.buffer);
  }

  @Post(':raceId/taps')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async recordTap(
    @Param('raceId') raceId: string,
    @Body() body: { bib?: number; source?: 'manual' | 'system' },
  ) {
    const bib = Number(body?.bib);
    const source = body?.source ?? 'manual';
    const event = await this.raceService.recordTap(raceId, bib, source);
    return { event };
  }

  @Post(':raceId/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async startRace(@Param('raceId') raceId: string) {
    const race = await this.raceService.startRace(raceId);
    return { race };
  }

  @Post(':raceId/stop')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async stopRace(@Param('raceId') raceId: string) {
    const race = await this.raceService.stopRace(raceId);
    return { race };
  }

  @Delete(':raceId/taps/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async cancelTap(
    @Param('raceId') raceId: string,
    @Param('eventId') eventId: string,
  ) {
    await this.raceService.cancelTap(raceId, eventId);
    return { eventId };
  }
}
