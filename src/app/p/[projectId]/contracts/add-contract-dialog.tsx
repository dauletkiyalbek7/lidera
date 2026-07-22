"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createContract, type HrFormState } from "@/lib/actions/hr";
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
} from "@/lib/hr";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: HrFormState = { error: null, saved: false };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохраняем…" : "Добавить договор"}
    </Button>
  );
}

export function AddContractDialog({
  projectId,
  staff,
  currencyLabel,
}: {
  projectId: string;
  staff: { id: string; name: string }[];
  currencyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createContract, INITIAL_STATE);
  const [lastSaved, setLastSaved] = useState(state.saved);
  const [kind, setKind] = useState<string>("employee");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Договор сохранён — закрываем окно, правя состояние во время рендера.
  if (state.saved !== lastSaved) {
    setLastSaved(state.saved);
    if (state.saved) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-[18px] w-[18px]" />
        Добавить договор
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 px-4 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Добавление договора"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="card w-full max-w-[560px] p-6 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">Новый договор</h2>
                <p className="mt-1 text-[13px] text-muted">
                  Карточка договора: реквизиты, сроки и сумма. Файлы платформа не хранит.
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
                <span className="text-[13px] font-medium text-muted">Название</span>
                <input
                  ref={firstFieldRef}
                  name="title"
                  required
                  minLength={2}
                  placeholder="Трудовой договор с продажником"
                  className={FIELD_CLASS}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">Тип</span>
                  <select
                    name="kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    className={FIELD_CLASS}
                  >
                    {CONTRACT_KINDS.map((item) => (
                      <option key={item} value={item}>
                        {CONTRACT_KIND_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">Статус</span>
                  <select name="status" defaultValue="active" className={FIELD_CLASS}>
                    {CONTRACT_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {CONTRACT_STATUS_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">
                    Номер <span className="text-faint">— необязательно</span>
                  </span>
                  <input name="number" placeholder="ТД-2026-014" className={FIELD_CLASS} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">
                    Сумма, {currencyLabel}
                  </span>
                  <input
                    name="amount"
                    type="number"
                    min={0}
                    step={1000}
                    defaultValue={0}
                    className={FIELD_CLASS}
                  />
                </label>

                {kind === "employee" && staff.length > 0 ? (
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[13px] font-medium text-muted">Сотрудник</span>
                    <select name="user_id" defaultValue="" className={FIELD_CLASS}>
                      <option value="">Не привязывать</option>
                      {staff.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[13px] font-medium text-muted">
                      Вторая сторона <span className="text-faint">— необязательно</span>
                    </span>
                    <input
                      name="counterparty"
                      placeholder="ТОО «Пример»"
                      className={FIELD_CLASS}
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">Начало</span>
                  <input name="starts_on" type="date" className={FIELD_CLASS} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">Окончание</span>
                  <input name="ends_on" type="date" className={FIELD_CLASS} />
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
