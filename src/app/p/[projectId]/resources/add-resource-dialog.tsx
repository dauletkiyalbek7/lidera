"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createResource, type ResourceFormState } from "@/lib/actions/resources";
import { RESOURCE_KINDS, RESOURCE_TYPES, type ResourceType } from "@/lib/resources";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: ResourceFormState = { error: null, saved: false };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохраняем…" : "Добавить"}
    </Button>
  );
}

export function AddResourceDialog({
  projectId,
  defaultType = "whatsapp",
}: {
  projectId: string;
  defaultType?: ResourceType;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createResource, INITIAL_STATE);
  const [lastSaved, setLastSaved] = useState(state.saved);
  const [type, setType] = useState<ResourceType>(defaultType);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Ресурс сохранён — закрываем окно, правя состояние во время рендера.
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

  const kind = RESOURCE_KINDS[type];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-[18px] w-[18px]" />
        Добавить ресурс
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 px-4 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Добавление ресурса"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="card w-full max-w-[520px] p-6 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">Новый ресурс</h2>
                <p className="mt-1 text-[13px] text-muted">
                  Номера и адреса приводятся к единому виду, чтобы один и тот же ресурс не
                  появился в списке дважды.
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
                <span className="text-[13px] font-medium text-muted">Тип</span>
                <select
                  ref={selectRef}
                  name="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as ResourceType)}
                  className={FIELD_CLASS}
                >
                  {RESOURCE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {RESOURCE_KINDS[item].title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">{kind.valueLabel}</span>
                <input
                  name="value"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={kind.valuePlaceholder}
                  className={FIELD_CLASS}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">
                  Подпись <span className="text-faint">— необязательно</span>
                </span>
                <input
                  name="label"
                  autoComplete="off"
                  placeholder="Например: основной номер отдела продаж"
                  className={FIELD_CLASS}
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
