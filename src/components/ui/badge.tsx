import { cn } from "@/lib/cn";

type Tone =
  | "brand"
  | "neutral"
  | "muted"
  | "positive"
  | "negative"
  | "warning"
  | "info"
  | "top";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  neutral: "bg-slate-50 text-ink ring-line",
  muted: "bg-slate-50 text-muted ring-line",
  positive: "bg-brand-50 text-brand-700 ring-brand-100",
  negative: "bg-rose-50 text-rose-600 ring-rose-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  info: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  // Насыщенный — лучший креатив должно быть видно сразу.
  top: "bg-brand text-white ring-brand",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Точка-индикатор статуса рядом с текстом. */
export function StatusDot({ tone = "positive" }: { tone?: Tone }) {
  const color =
    tone === "positive"
      ? "bg-brand"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "negative"
          ? "bg-rose-500"
          : "bg-slate-400";
  return <span className={cn("h-1.5 w-1.5 rounded-full", color)} />;
}
