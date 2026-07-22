import { cn } from "@/lib/cn";

/** Знак Lidera: восходящий столбик — рост проекта. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[12px] bg-brand text-white",
        "shadow-[0_8px_20px_-8px_rgba(8,208,141,0.95)]",
        className ?? "h-9 w-9",
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M5 19V13M12 19V8M19 19V5"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark />
      <span className="flex flex-col leading-tight">
        <span className="text-[17px] font-semibold tracking-tight text-ink">Lidera</span>
        {subtitle ? <span className="text-[11px] text-faint">{subtitle}</span> : null}
      </span>
    </span>
  );
}
