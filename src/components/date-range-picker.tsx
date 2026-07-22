"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CalendarRange } from "@/components/calendar-range";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  DEFAULT_RANGE_PRESET,
  RANGE_PRESET_LABELS,
  type RangePreset,
} from "@/lib/date-range";

/** Пресеты в порядке из ТЗ, раздел 5. */
const PRESETS: RangePreset[] = [
  "today",
  "yesterday",
  "last7",
  "last14",
  "this-week",
  "this-month",
  "last-week",
  "last-month",
  "all",
];

/**
 * Общий выбор периода. Значение хранится в URL,
 * поэтому любая страница может прочитать его на сервере и отфильтровать данные.
 */
export function DateRangePicker({
  preset,
  from,
  to,
  label,
}: {
  preset: RangePreset;
  from: string | null;
  to: string | null;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function apply(next: RangePreset, nextFrom?: string, nextTo?: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (next === DEFAULT_RANGE_PRESET) params.delete("range");
    else params.set("range", next);

    if (next === "custom" && nextFrom && nextTo) {
      params.set("from", nextFrom);
      params.set("to", nextTo);
    } else {
      params.delete("from");
      params.delete("to");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex h-11 items-center gap-2.5 rounded-[12px] border bg-surface px-3.5 text-[13px] transition",
          open ? "border-brand-200 text-brand-700" : "border-line text-ink hover:border-brand-200",
        )}
      >
        <Icon name="calendarRange" className="h-[18px] w-[18px] text-muted" />
        <span className="font-medium">{label}</span>
        <Icon
          name="chevron"
          className={cn("h-4 w-4 text-faint transition", open ? "-rotate-90" : "rotate-90")}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Выбор периода"
          className="card absolute right-0 z-40 mt-2 flex w-[min(92vw,520px)] flex-col gap-3 p-3 shadow-[var(--shadow-pop)] sm:flex-row"
        >
          <ul className="flex shrink-0 flex-col sm:w-[190px]">
            {PRESETS.map((value) => (
              <li key={value}>
                <button
                  type="button"
                  onClick={() => apply(value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px] transition",
                    preset === value
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-muted hover:bg-canvas hover:text-ink",
                  )}
                >
                  {RANGE_PRESET_LABELS[value]}
                  {preset === value ? <Icon name="check" className="h-4 w-4" /> : null}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-line pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
              Свой период
            </p>
            <CalendarRange
              from={from}
              to={to}
              onPick={(nextFrom, nextTo) => apply("custom", nextFrom, nextTo)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
