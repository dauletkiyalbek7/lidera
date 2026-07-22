import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * Карточка с выделенной шапкой: заголовок отбит линией и не сливается с содержимым.
 * Все блоки платформы используют её, чтобы иерархия была одинаковой.
 */
export function CardSection({
  title,
  hint,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card flex flex-col", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-canvas text-muted">
              <Icon name={icon} className="h-[18px] w-[18px]" />
            </span>
          ) : null}
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {hint ? <p className="mt-1 text-[12px] text-faint">{hint}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
