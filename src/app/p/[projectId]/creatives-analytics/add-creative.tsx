"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createCreative, type CreateCreativeState } from "@/lib/actions/ads";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/**
 * Ручное заведение креатива с UTM-меткой.
 * Позволяет настроить привязку «креатив → лид → чек» до синка с Meta или вообще
 * мимо него (WhatsApp, оффлайн) — владелец задаёт метку и ставит её в объявление.
 */

const INITIAL: CreateCreativeState = { message: null, error: null };

const inputClass =
  "h-9 w-full rounded-[9px] border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-200";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "h-9 px-3")}>
      {pending ? "…" : "Создать"}
    </button>
  );
}

export function AddCreativeButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCreative, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.message]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "sm", "h-9 gap-1.5 px-3")}
      >
        <Icon name="plus" className="h-4 w-4" /> Добавить креатив
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
          <h2 className="text-[15px] font-semibold text-ink">Новый креатив</h2>
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
            <span className="text-[12px] text-faint">Название</span>
            <input
              name="name"
              required
              placeholder="Например: Осень · видео 1"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">Площадка</span>
            <select name="platform" defaultValue="meta" className={inputClass}>
              <option value="meta">Meta (Instagram/Facebook)</option>
              <option value="tiktok">TikTok</option>
              <option value="">Другое / без площадки</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">UTM-метка</span>
            <input name="utm_label" placeholder="например, osen_video1" className={inputClass} />
            <span className="text-[11px] text-faint">
              Её ставят в ссылку объявления (utm_content) или в текст WhatsApp — по ней заявка и
              чек привяжутся к этому креативу.
            </span>
          </label>

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
        </form>
      </aside>
    </div>
  );
}
