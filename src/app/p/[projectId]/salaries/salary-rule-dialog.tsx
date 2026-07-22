"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveSalaryRule, type HrFormState } from "@/lib/actions/hr";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: HrFormState = { error: null, saved: false };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

export type SalaryTarget = {
  /** «role:manager» или «user:<id>» */
  value: string;
  label: string;
  baseSalary: number;
  percentOfSales: number;
  perTrial: number;
  perQualifiedLead: number;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохраняем…" : "Сохранить правило"}
    </Button>
  );
}

export function SalaryRuleDialog({
  projectId,
  targets,
  currencyLabel,
}: {
  projectId: string;
  targets: SalaryTarget[];
  currencyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveSalaryRule, INITIAL_STATE);
  const [lastSaved, setLastSaved] = useState(state.saved);
  const [target, setTarget] = useState(targets[0]?.value ?? "");
  const selectRef = useRef<HTMLSelectElement>(null);

  // Правило сохранено — закрываем окно, правя состояние во время рендера.
  if (state.saved !== lastSaved) {
    setLastSaved(state.saved);
    if (state.saved) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    selectRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const selected = targets.find((item) => item.value === target) ?? targets[0];

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={targets.length === 0}>
        Правила начисления
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 px-4 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Правило начисления зарплаты"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="card w-full max-w-[560px] p-6 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">
                  Правило начисления
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  Оклад плюс переменная часть. Правило на роль действует на всех, у кого нет
                  личного — личное всегда сильнее.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-faint transition hover:bg-canvas hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <form action={formAction} className="mt-6 flex flex-col gap-5">
              <input type="hidden" name="project_id" value={projectId} />

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">Кому</span>
                <select
                  ref={selectRef}
                  name="target"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  className={FIELD_CLASS}
                >
                  {targets.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">
                    Оклад за месяц, {currencyLabel}
                  </span>
                  <input
                    key={`${selected?.value}-base`}
                    name="base_salary"
                    type="number"
                    min={0}
                    step={1000}
                    defaultValue={selected?.baseSalary ?? 0}
                    className={FIELD_CLASS}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">% от продаж</span>
                  <input
                    key={`${selected?.value}-percent`}
                    name="percent_of_sales"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    defaultValue={selected?.percentOfSales ?? 0}
                    className={FIELD_CLASS}
                  />
                  <span className="text-[12px] text-faint">за вычетом возвратов</span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">
                    За пробный урок, {currencyLabel}
                  </span>
                  <input
                    key={`${selected?.value}-trial`}
                    name="per_trial"
                    type="number"
                    min={0}
                    step={500}
                    defaultValue={selected?.perTrial ?? 0}
                    className={FIELD_CLASS}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">
                    За квалиф. лид, {currencyLabel}
                  </span>
                  <input
                    key={`${selected?.value}-lead`}
                    name="per_qualified_lead"
                    type="number"
                    min={0}
                    step={100}
                    defaultValue={selected?.perQualifiedLead ?? 0}
                    className={FIELD_CLASS}
                  />
                </label>
              </div>

              {state.error ? (
                <p
                  role="alert"
                  className="rounded-[12px] bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-line pt-5">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Отмена
                </Button>
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
