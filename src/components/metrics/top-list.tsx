import { CardSection } from "@/components/ui/card-section";
import type { IconName } from "@/components/ui/icon";

export type TopEntry = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
};

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
              <span className="tabular inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-[12px] font-semibold text-muted">
                {index + 1}
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
