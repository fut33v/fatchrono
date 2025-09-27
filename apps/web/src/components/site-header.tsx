"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useRaceStore } from "@/store/race-store";

type NavItem = {
  key: string;
  href: string;
  label: string;
  isActive: boolean;
};

export function SiteHeader() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const currentRaceId = useRaceStore((state) => state.currentRaceId);

  const navItems: NavItem[] = [];

  navItems.push({ key: "home", href: "/", label: "Главная", isActive: pathname === "/" });

  if (currentRaceId) {
    navItems.push({
      key: "results",
      href: `/results/${currentRaceId}`,
      label: "Результаты",
      isActive: pathname.startsWith("/results/"),
    });

    if (user?.role === "admin") {
      navItems.push({
        key: "chrono",
        href: `/chrono/${currentRaceId}`,
        label: "Хронометраж",
        isActive: pathname.startsWith("/chrono/"),
      });
    }

    navItems.push({
      key: "leaderboard",
      href: `/leaderboard/${currentRaceId}`,
      label: "Лидер",
      isActive: pathname.startsWith("/leaderboard/"),
    });
  }

  if (user?.role === "admin") {
    navItems.push({
      key: "admin",
      href: "/admin",
      label: "Админ",
      isActive: pathname.startsWith("/admin"),
    });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3rem] text-teal-300"
        >
          <Image
            src="/logo.png"
            width={36}
            height={36}
            alt="Логотип ФАТРЭЙСИНГ ХРОНО"
            priority
            className="h-9 w-9 rounded"
          />
          <span>ФАТРЭЙСИНГ ХРОНО</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 transition ${
                item.isActive
                  ? "bg-teal-500/10 text-teal-200"
                  : "hover:bg-slate-800/70 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
