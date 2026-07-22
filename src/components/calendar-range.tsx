"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { addDays, today } from "@/lib/date-range";

/**
 * Календарь выбора периода — как в Ads Manager: кликнули начало, кликнули конец.
 * Работает на строках «ГГГГ-ММ-ДД», без Date внутри логики: сравнение строк
 * в этом формате совпадает со сравнением дат, а часовые пояса не путаются.
 */

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Понедельник — первый столбец, поэтому воскресенье уезжает в конец. */
function firstWeekdayOffset(year: number, month: number): number {
  const weekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return (weekday + 6) % 7;
}

export function CalendarRange({
  from,
  to,
  onPick,
}: {
  from: string | null;
  to: string | null;
  /** Отдаём готовый диапазон, только когда выбраны обе даты. */
  onPick: (from: string, to: string) => void;
}) {
  const limit = today();
  const start = from ?? limit;
  const [cursor, setCursor] = useState(() => ({
    year: Number(start.slice(0, 4)),
    month: Number(start.slice(5, 7)) - 1,
  }));

  /** Первый клик задаёт начало, второй — конец. */
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const selectedFrom = anchor ?? from;
  const selectedTo = anchor ? (hover && hover >= anchor ? hover : anchor) : to;

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const month = current.month + delta;
      if (month < 0) return { year: current.year - 1, month: 11 };
      if (month > 11) return { year: current.year + 1, month: 0 };
      return { year: current.year, month };
    });
  }

  function pick(date: string) {
    if (!anchor) {
      setAnchor(date);
      return;
    }
    // Кликнули раньше начала — считаем это новым началом, а не пустым диапазоном.
    const [a, b] = date >= anchor ? [anchor, date] : [date, anchor];
    setAnchor(null);
    setHover(null);
    onPick(a, b);
  }

  const total = daysInMonth(cursor.year, cursor.month);
  const offset = firstWeekdayOffset(cursor.year, cursor.month);
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, index) => iso(cursor.year, cursor.month, index + 1)),
  ];

  return (
    <div className="select-none">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Предыдущий месяц"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted transition hover:bg-canvas hover:text-ink"
        >
          <Icon name="chevron" className="h-4 w-4 -rotate-180" />
        </button>
        <span className="text-[12.5px] font-medium text-ink">
          {MONTHS[cursor.month]} {cursor.year}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Следующий месяц"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted transition hover:bg-canvas hover:text-ink"
        >
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-center text-[10.5px] text-faint">
            {day}
          </span>
        ))}

        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;

          const future = date > limit;
          const isStart = date === selectedFrom;
          const isEnd = date === selectedTo;
          const inside =
            Boolean(selectedFrom && selectedTo) &&
            date > (selectedFrom as string) &&
            date < (selectedTo as string);

          return (
            <button
              key={date}
              type="button"
              disabled={future}
              onClick={() => pick(date)}
              onMouseEnter={() => setHover(date)}
              className={cn(
                "tabular mx-auto flex h-8 w-8 items-center justify-center rounded-[9px] text-[12.5px] transition",
                future && "cursor-not-allowed text-faint/50",
                !future && !isStart && !isEnd && !inside && "text-ink hover:bg-canvas",
                inside && "bg-brand-50 text-brand-700",
                (isStart || isEnd) && "bg-brand font-semibold text-white",
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="mt-2 px-1 text-[11px] text-faint">
        {anchor
          ? "Теперь выберите вторую дату"
          : `Начало периода · последний доступный день ${addDays(limit, 0).slice(8)}.${limit.slice(5, 7)}`}
      </p>
    </div>
  );
}
