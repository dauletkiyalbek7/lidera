"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { setAttendanceModes, type OfficeState } from "@/lib/actions/attendance";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  ALWAYS_ON_STATUS,
  type AttendanceStatus,
} from "@/lib/hr";
import { Button } from "@/components/ui/button";

/**
 * Режимы табеля проекта: галочками выбираем нужные статусы. «На месте» включён
 * всегда (это отметка о приходе), поэтому его чекбокс заблокирован.
 */

const INITIAL: OfficeState = { message: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Сохраняем…" : "Сохранить режимы"}
    </Button>
  );
}

export function AttendanceModesForm({
  projectId,
  enabled,
}: {
  projectId: string;
  enabled: readonly AttendanceStatus[];
}) {
  const [state, formAction] = useActionState(setAttendanceModes, INITIAL);

  return (
    <form action={formAction} className="card p-5">
      <input type="hidden" name="project_id" value={projectId} />
      <h3 className="text-[15px] font-semibold text-ink">Режимы табеля</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        Выберите, какие статусы посещаемости нужны проекту. Ненужные (отпуск, больничный)
        можно убрать — они не будут мешать.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {ATTENDANCE_STATUSES.map((status) => {
          const locked = status === ALWAYS_ON_STATUS;
          return (
            <label
              key={status}
              className="inline-flex items-center gap-2 rounded-[10px] border border-line px-3 py-1.5 text-[13px] text-ink has-[:checked]:border-brand-200 has-[:checked]:bg-brand-50"
            >
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={locked || enabled.includes(status)}
                disabled={locked}
                className="h-3.5 w-3.5 accent-brand"
              />
              {ATTENDANCE_LABELS[status]}
              {locked ? <span className="text-[11px] text-faint">всегда</span> : null}
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SaveButton />
        {state.message ? <span className="text-[12px] text-brand-700">{state.message}</span> : null}
        {state.error ? <span className="text-[12px] text-rose-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
