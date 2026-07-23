"use client";

import { useFormStatus } from "react-dom";

import { toggleShift } from "@/lib/actions/distribution";
import { markTrialDone } from "@/lib/actions/trials";
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
