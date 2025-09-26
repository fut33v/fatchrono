"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

type TelegramWidgetUser = Record<string, unknown>;

declare global {
  interface Window {
    handleTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loginWithTelegramPayload = useAuthStore((state) => state.loginWithTelegramPayload);
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (user && isInitialized) {
      router.replace("/admin");
    }
  }, [user, isInitialized, router]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!BOT_USERNAME) {
      setError("Не указан бот Telegram. Проверьте переменную NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.");
      return;
    }

    window.handleTelegramAuth = async (telegramUser) => {
      try {
        await loginWithTelegramPayload(telegramUser);
        setError(undefined);
        router.replace("/admin");
      } catch (err) {
        console.error("Ошибка авторизации", err);
        setError("Не удалось авторизоваться через Telegram.");
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.defer = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "handleTelegramAuth(user)");
    script.setAttribute("data-radius", "8");

    container.innerHTML = "";
    container.appendChild(script);

    return () => {
      window.handleTelegramAuth = undefined;
      container.innerHTML = "";
    };
  }, [loginWithTelegramPayload, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-8 shadow-lg">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Вход для администраторов</h1>
          <p className="text-sm text-slate-400">
            Авторизуйтесь через Telegram, чтобы управлять гонками и командой хронометристов.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div ref={containerRef} className="flex justify-center" />

        {isLoading && (
          <p className="text-center text-sm text-slate-400">Выполняем вход…</p>
        )}
      </div>
    </main>
  );
}
