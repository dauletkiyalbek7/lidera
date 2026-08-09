"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { addCallByUrl, type AddCallState } from "@/lib/actions/calls";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL: AddCallState = { message: null, error: null };

const inputClass =
  "h-9 w-full rounded-[9px] border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-200";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "h-9 px-3")}>
      {pending ? "Разбор…" : "Добавить и оценить"}
    </button>
  );
}

/** Ручное добавление записи звонка по ссылке — способ проверить разбор до CRM. */
export function AddCallButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addCallByUrl, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message && !state.error) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.message, state.error]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "sm", "h-9 gap-1.5 px-3")}
      >
        <Icon name="calls" className="h-4 w-4" /> Добавить запись
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
      <aside className="relative z-10 flex h-full w-full max-w-[420px] flex-col overflow-y-auto bg-surface shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Запись звонка</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Закрыть"
            className="rounded-[9px] px-2 py-1 text-[16px] leading-none text-faint transition hover:bg-canvas hover:text-ink"
          >
            ×
          </button>
        </header>

        <form ref={formRef} action={formAction} className="flex flex-col gap-3 px-5 py-5">
          <input type="hidden" name="project_id" value={projectId} />

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">Ссылка на запись (mp3/wav)</span>
            <input name="recording_url" placeholder="https://…/call.mp3" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">Телефон клиента (необязательно)</span>
            <input name="phone" placeholder="+7…" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">Длительность, сек (необязательно)</span>
            <input name="duration_sec" type="number" min="0" placeholder="180" className={inputClass} />
          </label>

          <p className="text-[11.5px] leading-relaxed text-faint">
            Разбор идёт сразу: транскрипция и оценка. Для коротких записей — до минуты.
          </p>

          <div className="mt-1 flex items-center gap-2">
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
          {state.message && !state.error ? (
            <p className="text-[12px] text-brand-700">{state.message}</p>
          ) : null}
        </form>
      </aside>
    </div>
  );
}
