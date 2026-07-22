"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createReturn, type ReturnFormState } from "@/lib/actions/returns";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: ReturnFormState = { error: null, saved: false };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

export type SaleOption = {
  id: string;
  label: string;
  /** Сколько по продаже ещё можно вернуть. */
  remaining: number;
  remainingLabel: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Оформляем…" : "Оформить возврат"}
    </Button>
  );
}

export function CreateReturnDialog({
  projectId,
  sales,
  currencyLabel,
}: {
  projectId: string;
  sales: SaleOption[];
  currencyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createReturn, INITIAL_STATE);
  const [lastSaved, setLastSaved] = useState(state.saved);
  const [saleId, setSaleId] = useState(sales[0]?.id ?? "");
  const selectRef = useRef<HTMLSelectElement>(null);

  // Возврат оформлен — закрываем окно. Состояние правим во время рендера,
  // чтобы не гонять лишний проход через эффект.
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

  const selected = sales.find((sale) => sale.id === saleId) ?? sales[0];
  const noSales = sales.length === 0;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={noSales}>
        <Icon name="plus" className="h-[18px] w-[18px]" />
        Оформить возврат
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 px-4 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Оформление возврата"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="card w-full max-w-[520px] p-6 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">Возврат по продаже</h2>
                <p className="mt-1 text-[13px] text-muted">
                  Продажа останется в истории. Возврат уменьшит доход и прибыль за свой период.
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
                <span className="text-[13px] font-medium text-muted">Продажа</span>
                <select
                  ref={selectRef}
                  name="sale_id"
                  value={saleId}
                  onChange={(event) => setSaleId(event.target.value)}
                  className={FIELD_CLASS}
                >
                  {sales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.label}
                    </option>
                  ))}
                </select>
                {selected ? (
                  <span className="text-[12px] text-faint">
                    Доступно к возврату: {selected.remainingLabel}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">
                  Сумма возврата, {currencyLabel}
                </span>
                <input
                  // key сбрасывает поле на полную сумму, когда выбрали другую продажу.
                  key={selected?.id}
                  name="amount"
                  type="number"
                  min={1}
                  max={selected?.remaining}
                  step={100}
                  required
                  defaultValue={selected?.remaining}
                  className={FIELD_CLASS}
                />
                <span className="text-[12px] text-faint">
                  Частичный возврат: поставьте сумму меньше полной.
                </span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">
                  Причина <span className="text-faint">— необязательно</span>
                </span>
                <textarea
                  name="reason"
                  rows={3}
                  maxLength={500}
                  placeholder="Например: не подошло расписание, клиент попросил вернуть деньги"
                  className="w-full resize-none rounded-[12px] border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none"
                />
              </label>

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
