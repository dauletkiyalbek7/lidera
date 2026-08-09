"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { setCallRubric, type RubricState } from "@/lib/actions/call-rubric";
import { MAX_CRITERIA, type CallRubric, type RubricCriterion } from "@/lib/call-rubric";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL: RubricState = { message: null, error: null };

const inputClass =
  "h-9 w-full rounded-[9px] border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-200";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "h-9 px-3")}>
      {pending ? "Сохранение…" : "Сохранить правила"}
    </button>
  );
}

type Row = { label: string; weight: number };

/** Редактор правил оценки звонков: критерии с весами + скрипт отдела продаж. */
export function RubricEditor({ projectId, rubric }: { projectId: string; rubric: CallRubric }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setCallRubric, INITIAL);
  const [rows, setRows] = useState<Row[]>(
    rubric.criteria.map((c: RubricCriterion) => ({ label: c.label, weight: c.weight })),
  );
  const [script, setScript] = useState(rubric.script);

  useEffect(() => {
    if (state.message && !state.error) setOpen(false);
  }, [state.message, state.error]);

  const total = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((prev) => (prev.length < MAX_CRITERIA ? [...prev, { label: "", weight: 0 }] : prev));
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "sm", "h-9 gap-1.5 px-3")}
      >
        <Icon name="sliders" className="h-4 w-4" /> Правила оценки
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
      />
      <aside className="relative z-10 flex h-full w-full max-w-[560px] flex-col overflow-y-auto bg-surface shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Правила оценки звонков</h2>
            <p className="mt-0.5 text-[12px] text-faint">
              AI оценивает каждый звонок по этим критериям и вашему скрипту.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Закрыть"
            className="rounded-[9px] px-2 py-1 text-[16px] leading-none text-faint transition hover:bg-canvas hover:text-ink"
          >
            ×
          </button>
        </header>

        <form action={formAction} className="flex flex-col gap-4 px-5 py-5">
          <input type="hidden" name="project_id" value={projectId} />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
                Критерии и веса
              </span>
              <span
                className={`tabular text-[12px] ${total === 100 ? "text-brand-700" : "text-amber-700"}`}
              >
                Сумма: {total}/100
              </span>
            </div>

            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  name="criteria_label"
                  value={row.label}
                  onChange={(e) => setRow(i, { label: e.target.value })}
                  placeholder="Например: Выявление потребности"
                  className={inputClass}
                />
                <input
                  name="criteria_weight"
                  type="number"
                  min="0"
                  max="100"
                  value={row.weight || ""}
                  onChange={(e) => setRow(i, { weight: Number(e.target.value) })}
                  placeholder="вес"
                  className={`${inputClass} w-20 shrink-0`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Удалить критерий"
                  className="shrink-0 rounded-[8px] px-2 py-1 text-[16px] leading-none text-faint transition hover:bg-canvas hover:text-rose-500"
                >
                  ×
                </button>
              </div>
            ))}

            {rows.length < MAX_CRITERIA ? (
              <button
                type="button"
                onClick={addRow}
                className="mt-1 inline-flex w-fit items-center gap-1 rounded-[8px] px-2 py-1 text-[12.5px] font-medium text-brand-700 transition hover:bg-brand-50"
              >
                <Icon name="plus" className="h-3.5 w-3.5" /> Добавить критерий
              </button>
            ) : null}
            {total !== 100 ? (
              <p className="text-[11.5px] text-amber-700">
                Лучше, чтобы сумма весов была 100 — тогда балл будет по шкале 0–100.
              </p>
            ) : null}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
              Скрипт и правила (необязательно)
            </span>
            <textarea
              name="script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={8}
              placeholder="Что менеджер обязан сказать и сделать: приветствие, обязательные вопросы, презентация, работа с возражениями, договорённость…"
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-brand-200"
            />
          </label>

          <div className="flex items-center gap-2">
            <SubmitButton />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 px-3 text-[13px] text-faint transition hover:text-ink"
            >
              Отмена
            </button>
          </div>

          {state.error ? <p className="text-[12px] text-rose-600">{state.error}</p> : null}
        </form>
      </aside>
    </div>
  );
}
