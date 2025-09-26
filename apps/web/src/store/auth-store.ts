"use client";

import { create } from "zustand";
import { API_BASE_URL } from "@/lib/config";

export type AuthUser = {
  id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  role: "admin" | "staff" | "viewer";
};

export type TelegramAuthResponse = {
  accessToken: string;
  user: AuthUser;
};

type AuthState = {
  token?: string;
  user?: AuthUser;
  isInitialized: boolean;
  isLoading: boolean;
  error?: string;
  hydrate: () => Promise<void>;
  loginWithTelegramPayload: (payload: Record<string, unknown>) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "fatchrono-auth";

async function fetchProfile(token: string): Promise<AuthUser | undefined> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return undefined;
  }

  return (await response.json()) as AuthUser;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: undefined,
  user: undefined,
  isInitialized: false,
  isLoading: false,
  error: undefined,
  hydrate: async () => {
    if (typeof window === "undefined") {
      return;
    }

    const persisted = window.localStorage.getItem(STORAGE_KEY);
    if (!persisted) {
      set({ isInitialized: true });
      return;
    }

    try {
      const data = JSON.parse(persisted) as { token?: string; user?: AuthUser };
      if (!data.token) {
        window.localStorage.removeItem(STORAGE_KEY);
        set({ isInitialized: true });
        return;
      }

      set({ isLoading: true });
      const profile = await fetchProfile(data.token);
      if (!profile) {
        window.localStorage.removeItem(STORAGE_KEY);
        set({ token: undefined, user: undefined, isInitialized: true, isLoading: false });
        return;
      }

      set({
        token: data.token,
        user: profile,
        isInitialized: true,
        isLoading: false,
        error: undefined,
      });
    } catch (error) {
      console.error("Не удалось восстановить сессию", error);
      window.localStorage.removeItem(STORAGE_KEY);
      set({ token: undefined, user: undefined, isInitialized: true, isLoading: false });
    }
  },
  loginWithTelegramPayload: async (payload) => {
    set({ isLoading: true, error: undefined });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/telegram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as TelegramAuthResponse;

      set({ token: data.accessToken, user: data.user, isInitialized: true, isLoading: false });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: data.accessToken, user: data.user }),
        );
      }
    } catch (error) {
      console.error("Ошибка входа через Telegram", error);
      set({ error: "Не удалось войти через Telegram.", isLoading: false });
      throw error;
    }
  },
  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ token: undefined, user: undefined, error: undefined, isInitialized: true, isLoading: false });
  },
}));
