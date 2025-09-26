import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RaceService } from './race.service';
import { CreateRaceDto } from './dto/create-race.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('race')
export class RaceController {
  constructor(private readonly raceService: RaceService) {}

  @Get('state')
  getState() {
    return this.raceService.getState();
  }

  @Get('laps-remaining')
  getLapsRemaining() {
    return this.raceService.getLapsRemaining();
  }

  @Get(':raceId/state')
  getStateByRace(@Param('raceId') raceId: string) {
    return this.raceService.getStateForRace(raceId);
  }

  @Get(':raceId/laps-remaining')
  getLapsRemainingByRace(@Param('raceId') raceId: string) {
    return this.raceService.getLapsRemainingForRace(raceId);
  }

  @Post('taps')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createTap(@Body() body: { bib?: number; source?: 'manual' | 'system' }) {
    const bib = Number(body?.bib);
    const source = body?.source ?? 'manual';
    const event = this.raceService.recordTap(bib, source);
    return { event };
  }

  @Delete('taps/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  cancelTap(@Param('id') eventId: string) {
    this.raceService.cancelTap(eventId);
    return { eventId };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listRaces() {
    return {
      races: this.raceService.getRaces(),
      activeRaceId: this.raceService.getState().race?.id ?? null,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createRace(@Body() body: CreateRaceDto) {
    const race = this.raceService.createRace(body);
    return { race };
  }

  @Post(':raceId/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setActiveRace(@Param('raceId') raceId: string) {
    const race = this.raceService.setActiveRace(raceId);
    return { raceId: race.id };
  }

  @Post(':raceId/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addCategory(@Param('raceId') raceId: string, @Body() body: CreateCategoryDto) {
    const category = this.raceService.addCategory(raceId, body);
    return { category };
  }

  @Patch(':raceId/categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateCategory(
    @Param('raceId') raceId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const category = this.raceService.updateCategory(raceId, categoryId, body);
    return { category };
  }

  @Post(':raceId/participants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addParticipant(
    @Param('raceId') raceId: string,
    @Body() body: CreateParticipantDto,
  ) {
    const participant = this.raceService.addParticipant(raceId, body);
    return { participant };
  }

  @Patch(':raceId/participants/:participantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateParticipant(
    @Param('raceId') raceId: string,
    @Param('participantId') participantId: string,
    @Body() body: UpdateParticipantDto,
  ) {
    const participant = this.raceService.updateParticipant(raceId, participantId, body);
    return { participant };
  }
}
