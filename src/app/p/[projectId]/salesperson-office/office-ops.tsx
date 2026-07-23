"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { toggleShift } from "@/lib/actions/distribution";
import { markCourseSold, markTrialDone, type TrialState } from "@/lib/actions/trials";
import { Button, buttonClass } from "@/components/ui/button";

/**
 * Действия продажника: тумблер смены (пробные приходят по кругу только на смене)
 * и отметка «пробный проведён». Оба — формы к серверным действиям, отдельные
 * кнопки лишь показывают состояние ожидания.
 */

function ShiftButton({ onShift }: { onShift: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={onShift ? "secondary" : "primary"}
      size="sm"
      disabled={pending}
    >
      {pending ? "…" : onShift ? "🔴 Уйти со смены" : "🟢 Встать на смену"}
    </Button>
  );
}

export function ShiftToggle({ projectId, onShift }: { projectId: string; onShift: boolean }) {
  return (
    <form action={toggleShift}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="on_shift" value={onShift ? "0" : "1"} />
      <ShiftButton onShift={onShift} />
    </form>
  );
}

function DoneButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass("secondary", "sm", "h-8 px-2.5")}
    >
      {pending ? "…" : "Пробный проведён"}
    </button>
  );
}

export function TrialDoneButton({ projectId, leadId }: { projectId: string; leadId: string }) {
  return (
    <form action={markTrialDone}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="lead_id" value={leadId} />
      <DoneButton />
    </form>
  );
}

const SOLD_INITIAL: TrialState = { message: null, error: null };

function SoldButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "h-8 px-2.5")}>
      {pending ? "…" : "Готово"}
    </button>
  );
}

/** Отметка «Курс продан»: сумма → настоящая продажа, чек продажник пришлёт боту. */
export function CourseSoldButton({
  projectId,
  leadId,
  currencySymbol,
}: {
  projectId: string;
  leadId: string;
  currencySymbol: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(markCourseSold, SOLD_INITIAL);

  if (state.message) {
    return <span className="text-[12px] text-brand-700">{state.message}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "sm", "h-8 px-2.5")}
      >
        Курс продан
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          name="amount"
          min="1"
          step="1"
          required
          placeholder={`Сумма, ${currencySymbol}`}
          className="h-8 w-28 rounded-[9px] border border-line bg-surface px-2 text-[12px] text-ink focus:border-brand-200 focus:outline-none"
        />
        <SoldButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Отменить"
          className="h-8 px-1.5 text-[13px] text-faint transition hover:text-ink"
        >
          ×
        </button>
      </div>
      {state.error ? <span className="text-[11px] text-rose-600">{state.error}</span> : null}
    </form>
  );
}
