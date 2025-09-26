import { Module } from '@nestjs/common';
import { RaceController } from './race.controller';
import { RaceGateway } from './race.gateway';
import { RaceService } from './race.service';

@Module({
  controllers: [RaceController],
  providers: [RaceService, RaceGateway],
  exports: [RaceService],
})
export class RaceModule {}
