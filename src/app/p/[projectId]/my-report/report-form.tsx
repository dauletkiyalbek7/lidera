"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveEmployeeReport, type ReportFormState } from "@/lib/actions/reports";
import { REPORT_FIELDS } from "@/lib/reports";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: ReportFormState = { error: null, saved: false };

const TEXTAREA_CLASS =
  "w-full resize-none rounded-[12px] border border-line bg-canvas px-3.5 py-2.5 text-sm " +
  "text-ink placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохраняем…" : "Сохранить отчёт"}
    </Button>
  );
}

/** Форма ежедневного отчёта. Сотрудник видит и правит только свои записи. */
export function ReportForm({
  projectId,
  defaultDate,
  defaultValues,
}: {
  projectId: string;
  defaultDate: string;
  defaultValues: Record<string, string>;
}) {
  const [state, formAction] = useActionState(saveEmployeeReport, INITIAL_STATE);

  return (
    <form action={formAction} className="card flex flex-col gap-5 p-5">
      <input type="hidden" name="project_id" value={projectId} />

      <label className="flex flex-col gap-1.5 sm:max-w-[220px]">
        <span className="text-[13px] font-medium text-muted">Дата отчёта</span>
        <input
          type="date"
          name="report_date"
          defaultValue={defaultDate}
          max={defaultDate}
          required
          className="h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink transition focus:border-brand-200 focus:bg-surface focus:outline-none"
        />
      </label>

      {REPORT_FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">
            {field.label}
            {field.required ? null : <span className="text-faint"> — необязательно</span>}
          </span>
          <textarea
            name={field.name}
            rows={field.rows}
            required={field.required}
            placeholder={field.placeholder}
            defaultValue={defaultValues[field.name] ?? ""}
            className={TEXTAREA_CLASS}
          />
        </label>
      ))}

      {state.error ? (
        <p role="alert" className="rounded-[12px] bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="rounded-[12px] bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-700">
          Отчёт сохранён.
        </p>
      ) : null}

      <div className="flex justify-end border-t border-line pt-4">
        <SubmitButton />
      </div>
    </form>
  );
}
