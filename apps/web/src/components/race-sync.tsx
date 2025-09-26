"use client";

import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL, SOCKET_URL } from "@/lib/config";
import { useRaceStore, type RaceStatePayload, type TapEvent } from "@/store/race-store";

let socket: Socket | null = null;
let subscribers = 0;

export function RaceSync() {
  const setInitialState = useRaceStore((state) => state.setInitialState);
  const upsertTapEvent = useRaceStore((state) => state.upsertTapEvent);
  const removeTapEvent = useRaceStore((state) => state.removeTapEvent);
  const setConnectionStatus = useRaceStore((state) => state.setConnectionStatus);
  const setError = useRaceStore((state) => state.setError);
  const currentRaceId = useRaceStore((state) => state.currentRaceId);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const targetUrl = currentRaceId
          ? `${API_BASE_URL}/race/${currentRaceId}/state`
          : `${API_BASE_URL}/race/state`;
        const response = await fetch(targetUrl, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!isMounted) {
          return;
        }
        setInitialState(data);
        setError(undefined);
      } catch (error) {
        console.error("Не удалось получить состояние гонки", error);
        if (isMounted) {
          setError("Не удалось получить состояние гонки");
        }
      }
    }

    bootstrap();

    if (!socket) {
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        autoConnect: true,
      });

      socket.on("connect", () => {
        setConnectionStatus(true);
        setError(undefined);
      });

      socket.on("disconnect", () => {
        setConnectionStatus(false);
      });

      socket.on("connect_error", (error) => {
        console.error("Ошибка подключения к сокету", error);
        setConnectionStatus(false);
        setError("Проблема с подключением к серверу результатов");
      });

      socket.on("race:state", (payload: RaceStatePayload) => {
        setInitialState(payload);
      });

      socket.on("race:tap-recorded", (event: TapEvent) => {
        upsertTapEvent(event);
      });

      socket.on("race:tap-cancelled", (payload: { eventId: string }) => {
        removeTapEvent(payload.eventId);
      });
    } else {
      setConnectionStatus(socket.connected);
    }

    subscribers += 1;

    return () => {
      isMounted = false;
      subscribers -= 1;
      if (subscribers <= 0 && socket) {
        socket.off("race:state");
        socket.off("race:tap-recorded");
        socket.off("race:tap-cancelled");
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.close();
        socket = null;
        subscribers = 0;
      }
    };
  }, [currentRaceId, setInitialState, upsertTapEvent, removeTapEvent, setConnectionStatus, setError]);

  return null;
}

export default RaceSync;
