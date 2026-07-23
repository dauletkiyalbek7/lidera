"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { bookTrial, type TrialState } from "@/lib/actions/trials";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

/**
 * Запись лида на пробный урок прямо в таблице «Лиды».
 * Менеджер жмёт «Записать на пробный», выбирает дату/время — лид уходит
 * продажнику по кругу, оплата пробного (990 ₸) фиксируется.
 */

const INITIAL: TrialState = { message: null, error: null };

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "h-8 px-2.5")}>
      {pending ? "…" : "Готово"}
    </button>
  );
}

export function BookTrialCell({
  projectId,
  leadId,
  trialPrice,
  currency,
}: {
  projectId: string;
  leadId: string;
  trialPrice: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(bookTrial, INITIAL);

  if (state.message) {
    return <span className="text-[12px] text-brand-700">{state.message}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[9px] border border-line px-2.5 py-1 text-[12px] text-muted transition hover:border-brand-200 hover:text-brand-700"
      >
        Записать на пробный
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="flex items-center gap-1.5">
        <input
          type="datetime-local"
          name="trial_at"
          required
          className="h-8 rounded-[9px] border border-line bg-surface px-2 text-[12px] text-ink focus:border-brand-200 focus:outline-none"
        />
        <ConfirmButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Отменить"
          className="h-8 px-1.5 text-[13px] text-faint transition hover:text-ink"
        >
          ×
        </button>
      </div>
      <span className="text-[11px] text-faint">
        Пробный оплачен · {formatMoney(trialPrice, currency)}
      </span>
      {state.error ? <span className="text-[11px] text-rose-600">{state.error}</span> : null}
    </form>
  );
}
