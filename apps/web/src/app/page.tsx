import Link from "next/link";

const links = [
  {
    href: "/results",
    title: "Живые результаты",
    description:
      "Следите за позициями, графиками кругов и статистикой гонщиков в реальном времени.",
  },
  {
    href: "/chrono",
    title: "Ручной хронометраж",
    description:
      "Отмечайте гонщиков при пересечении контрольной линии даже без стабильного интернета.",
  },
  {
    href: "/admin",
    title: "Админ-панель гонки",
    description:
      "Создавайте гонки, управляйте списком участников и импортируйте заявки.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-950 from-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
        <header className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1 text-sm font-medium uppercase tracking-wide text-slate-300 shadow">
            FatChrono
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Платформа хронометража для критериумов, многодневок и любительских
            стартов.
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Авторизуйтесь через Telegram, фиксируйте круги удобными кнопками и
            транслируйте точные результаты гонщикам и зрителям за секунды.
          </p>
        </header>

        <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow transition hover:border-teal-400/70 hover:bg-slate-900/70"
            >
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-slate-100 group-hover:text-teal-300">
                  {link.title}
                </h2>
                <p className="text-sm text-slate-400 group-hover:text-slate-200">
                  {link.description}
                </p>
              </div>
              <span className="mt-8 text-sm font-medium text-teal-300">
                Открыть →
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
