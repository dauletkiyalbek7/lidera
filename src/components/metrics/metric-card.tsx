import { Icon, type IconName } from "@/components/ui/icon";
import { formatDelta } from "@/lib/format";
import { cn } from "@/lib/cn";

const TONE_CLASS = {
  positive: "text-brand-700 bg-brand-50",
  negative: "text-rose-600 bg-rose-50",
  neutral: "text-muted bg-canvas",
} as const;

/** Карточка метрики: значение, подпись и изменение к прошлому периоду. */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  change,
  tone = "neutral",
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
  change?: number | null;
  tone?: "positive" | "negative" | "neutral";
  accent?: boolean;
}) {
  return (
    <div className={cn("card p-5", accent && "ring-1 ring-brand-100")}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] text-muted">{label}</span>
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-[10px]",
            accent ? "bg-brand text-white" : "bg-canvas text-muted",
          )}
        >
          <Icon name={icon} className="h-[17px] w-[17px]" />
        </span>
      </div>

      <p className="tabular mt-3 text-[24px] font-semibold leading-none tracking-tight text-ink">
        {value}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {change !== undefined ? (
          <span
            className={cn(
              "tabular inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              TONE_CLASS[tone],
            )}
          >
            {formatDelta(change)}
          </span>
        ) : null}
        {hint ? <span className="text-[11.5px] text-faint">{hint}</span> : null}
      </div>
    </div>
  );
}
