"use client";

import { useRef } from "react";

import { cn } from "@/lib/cn";

/**
 * Тумблер, который сразу отправляет форму серверному действию.
 * Без JS остаётся обычной кнопкой отправки — состояние всё равно переключится.
 */
export function ToggleForm({
  action,
  fields,
  checked,
  disabled = false,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  checked: boolean;
  disabled?: boolean;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="enabled" value={checked ? "false" : "true"} />

      <button
        type="submit"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          checked ? "bg-brand" : "bg-slate-200",
          disabled ? "cursor-not-allowed opacity-40" : "hover:opacity-90",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </form>
  );
}

/** Чекбокс прав доступа: отправляет обе галочки раздела разом. */
export function AccessCheckbox({
  action,
  fields,
  checked,
  disabled = false,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  checked: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <form action={action} className="inline-flex">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-[7px] border transition",
          checked
            ? "border-brand bg-brand text-white"
            : "border-line bg-surface text-transparent hover:border-brand-200",
          disabled && "cursor-not-allowed opacity-40",
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="m5 12.5 5 5L19 6.5"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
