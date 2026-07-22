/**
 * Шапка раздела. Надзаголовок называет блок меню, заголовок крупный,
 * снизу линия — чтобы заголовок читался как заголовок, а не как обычный текст.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-brand-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.022em] text-ink">
          {title}
        </h1>
        {subtitle ? <p className="mt-2.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/**
 * Подпись группы блоков на странице: отделяет карточки метрик от графика,
 * график от команды и так далее.
 */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 mt-9 flex items-center gap-4">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">
        {children}
      </h2>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
