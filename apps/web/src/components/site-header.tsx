"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

const links = [
  { href: "/", label: "Главная" },
  { href: "/results", label: "Результаты" },
  { href: "/chrono", label: "Хронометраж" },
  { href: "/leaderboard", label: "Лидер" },
  { href: "/admin", label: "Админ" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3rem] text-teal-300">
          FatChrono
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            if (link.href === "/admin" && user?.role !== "admin") {
              return null;
            }
            if (link.href === "/chrono" && user?.role !== "admin") {
              return null;
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  isActive
                    ? "bg-teal-500/10 text-teal-200"
                    : "hover:bg-slate-800/70 hover:text-slate-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
