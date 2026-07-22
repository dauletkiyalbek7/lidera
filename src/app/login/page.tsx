import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";

import { LoginForm } from "./login-form";

const HIGHLIGHTS = [
  {
    icon: "building" as const,
    title: "Все проекты в одном месте",
    text: "Каждый клиент — отдельный, полностью изолированный кабинет.",
  },
  {
    icon: "chart" as const,
    title: "Метрики за любой период",
    text: "Доход, расход, лиды, пробные, продажи и конверсия — одним взглядом.",
  },
  {
    icon: "lock" as const,
    title: "Данные разделены на уровне базы",
    text: "Сотрудник физически не видит чужой проект, а не просто «не видит кнопку».",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/projects";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink px-14 py-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -left-24 -top-28 h-[420px] w-[420px] rounded-full bg-brand/25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 right-0 h-[380px] w-[380px] rounded-full bg-brand/15 blur-3xl"
        />

        <div className="relative flex items-center gap-3 text-white">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-brand">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M5 19V13M12 19V8M19 19V5"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Lidera</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-white">
            Платформа управления рекламными проектами
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Запускайте рекламу для разных клиентов и держите всю картину — деньги, лиды
            и продажи — в одном рабочем пространстве.
          </p>

          <ul className="mt-10 flex flex-col gap-6">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/10 text-brand-300">
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-white">{item.title}</span>
                  <span className="text-[13px] leading-relaxed text-white/50">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-white/35">
          © {new Date().getFullYear()} Lidera
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="mt-8 lg:mt-0">
            <h2 className="text-[26px] font-semibold tracking-tight text-ink">Вход</h2>
            <p className="mt-2 text-sm text-muted">
              Введите доступы, которые выдала платформа.
            </p>
          </div>

          <div className="mt-8">
            <LoginForm next={safeNext} />
          </div>

          <p className="mt-8 text-[13px] leading-relaxed text-faint">
            Регистрации нет: аккаунты владельца и сотрудников создаются внутри платформы.
            Забыли пароль — обратитесь к владельцу проекта.
          </p>
        </div>
      </section>
    </main>
  );
}
