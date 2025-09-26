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

  handleConnection(client: Socket) {
    client.emit('race:state', this.raceService.getState());
  }

  private forwardEvent(event: RaceBroadcastEvent) {
    if (!this.server) {
      return;
    }

    if (event.type === 'tap-recorded') {
      this.server.emit('race:tap-recorded', event.payload);
    }

    if (event.type === 'tap-cancelled') {
      this.server.emit('race:tap-cancelled', event.payload);
    }

    if (event.type === 'race-updated') {
      this.server.emit('race:state', event.payload);
    }
  }
}
