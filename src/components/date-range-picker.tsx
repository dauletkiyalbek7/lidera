"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");
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
          className="card absolute right-0 z-40 mt-2 w-[280px] p-2 shadow-[var(--shadow-pop)]"
        >
          <ul className="flex flex-col">
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

          <div className="mt-2 border-t border-line px-3 pb-1 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
              Произвольный период
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(event) => setCustomFrom(event.target.value)}
                aria-label="Дата от"
                className="h-9 w-full rounded-[10px] border border-line bg-canvas px-2 text-[12px] text-ink focus:border-brand-200 focus:outline-none"
              />
              <span className="text-faint">—</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) => setCustomTo(event.target.value)}
                aria-label="Дата до"
                className="h-9 w-full rounded-[10px] border border-line bg-canvas px-2 text-[12px] text-ink focus:border-brand-200 focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={!customFrom || !customTo}
              onClick={() => apply("custom", customFrom, customTo)}
              className="mt-2 h-9 w-full rounded-[10px] bg-brand text-[13px] font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              Применить
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
