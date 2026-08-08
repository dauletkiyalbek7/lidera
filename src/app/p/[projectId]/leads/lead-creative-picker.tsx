"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setLeadCreative } from "@/lib/actions/leads";
import type { CreativePickOption } from "@/lib/queries/crm";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Ручной выбор креатива на лиде: выпадающий список любого объявления проекта.
 * Меняем оптимистично — значение встаёт сразу, сервер догоняет; при ошибке
 * откатываем. Привязку унаследует и продажа лида (см. setLeadCreative).
 */
export function LeadCreativePicker({
  projectId,
  leadId,
  currentId,
  currency,
  options,
}: {
  projectId: string;
  leadId: string;
  currentId: string | null;
  currency: string;
  options: CreativePickOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(currentId ?? "");
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await setLeadCreative(projectId, leadId, next || null);
      if (!result.ok) setValue(previous);
      else router.refresh();
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(event) => change(event.target.value)}
      title="Выбрать объявление, с которого пришёл лид"
      className={cn(
        "h-8 max-w-[220px] rounded-[9px] border border-line bg-surface px-2 text-[12.5px] text-ink outline-none transition focus:border-brand-200",
        value ? "" : "text-faint",
        pending ? "opacity-60" : "",
      )}
    >
      <option value="">— без креатива —</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.title}
          {option.spend > 0 ? ` · ${formatMoney(option.spend, currency, { compact: true })}` : ""}
        </option>
      ))}
    </select>
  );
}
