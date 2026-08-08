import { Avatar } from "@/components/ui/avatar";
import { CardSection } from "@/components/ui/card-section";
import type { IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export type TopEntry = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
};

/** Медали для тройки лидеров; остальные — нейтральный ранг. */
const MEDAL = [
  "bg-amber-100 text-amber-700 ring-amber-200",
  "bg-slate-200 text-slate-600 ring-slate-300",
  "bg-orange-100 text-orange-700 ring-orange-200",
] as const;

/** Топ сотрудников: менеджеры и продажники (ТЗ, раздел 6.1). */
export function TopList({
  title,
  hint,
  icon,
  entries,
  emptyText,
}: {
  title: string;
  hint: string;
  icon: IconName;
  entries: TopEntry[];
  emptyText: string;
}) {
  return (
    <CardSection title={title} hint={hint} icon={icon}>
      {entries.length === 0 ? (
        <p className="rounded-[12px] bg-canvas px-4 py-6 text-center text-[12.5px] leading-relaxed text-faint">
          {emptyText}
        </p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 border-b border-line py-3 last:border-b-0 last:pb-0"
            >
              <span className="relative shrink-0">
                <Avatar name={entry.name} size="lg" />
                <span
                  className={cn(
                    "tabular absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] font-bold ring-2 ring-surface",
                    index < 3 ? MEDAL[index] : "bg-canvas text-muted",
                  )}
                >
                  {index + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">
                  {entry.name}
                </span>
                <span className="block text-[11.5px] text-faint">{entry.secondary}</span>
              </span>
              <span className="tabular shrink-0 text-[13.5px] font-semibold text-ink">
                {entry.primary}
              </span>
            </li>
          ))}
        </ol>
      )}
    </CardSection>
  );
}
