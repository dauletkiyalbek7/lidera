import { initials } from "@/lib/avatar";
import { cn } from "@/lib/cn";

/**
 * Кружок с инициалами. Общий для CRM-воронки и таблиц лидов/клиентов —
 * цвет задаётся снаружи (этап сделки, фирменный акцент), размер — пресетом.
 */
const SIZE = {
  sm: "h-7 w-7 text-[10.5px]",
  md: "h-8 w-8 text-[11px]",
  lg: "h-9 w-9 text-[12px]",
} as const;

export function Avatar({
  name,
  soft = "bg-brand-50",
  text = "text-brand-700",
  size = "md",
  ring,
  className,
}: {
  name: string;
  /** Мягкий фон кружка (обычно из палитры этапа). */
  soft?: string;
  /** Цвет инициалов. */
  text?: string;
  size?: keyof typeof SIZE;
  /** Кольцо-акцент, например для топ-клиента. */
  ring?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        SIZE[size],
        soft,
        text,
        ring,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
