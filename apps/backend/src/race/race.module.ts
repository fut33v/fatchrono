import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RaceController } from './race.controller';
import { RaceGateway } from './race.gateway';
import { RaceService } from './race.service';

@Module({
  imports: [PrismaModule],
  controllers: [RaceController],
  providers: [RaceService, RaceGateway],
  exports: [RaceService],
})
export class RaceModule {}
