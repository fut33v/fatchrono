import {
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RaceService } from './race.service';
import { RaceBroadcastEvent } from './race.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RaceGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private unsubscribe?: () => void;

  constructor(private readonly raceService: RaceService) {}

  onModuleInit() {
    this.unsubscribe = this.raceService.subscribe((event) => {
      this.forwardEvent(event);
    });
  }

  onModuleDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  handleConnection(_client: Socket) {}

  private forwardEvent(event: RaceBroadcastEvent) {
    if (!this.server) {
      return;
    }

    if (event.type === 'tap-recorded') {
      this.server.emit('race:tap-recorded', {
        raceId: event.raceId,
        event: event.payload,
      });
    }

    if (event.type === 'tap-cancelled') {
      this.server.emit('race:tap-cancelled', {
        raceId: event.raceId,
        eventId: event.payload.eventId,
      });
    }

    if (event.type === 'race-updated') {
      this.server.emit('race:state', {
        raceId: event.raceId,
        state: event.payload,
      });
    }
  }
}
