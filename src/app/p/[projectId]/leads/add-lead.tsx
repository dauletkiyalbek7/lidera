"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createLead, type CreateLeadState } from "@/lib/actions/leads";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { CreativeOption } from "@/lib/queries/crm";

/**
 * Ручное заведение лида — путь для WhatsApp без чат-бота.
 * Менеджер видит метку креатива в первом сообщении (её ставят в текст рекламы
 * click-to-WhatsApp) и выбирает креатив из списка меток. Так заявка сразу
 * привязана к креативу, а позже чек унаследует эту привязку.
 */

const INITIAL: CreateLeadState = { message: null, error: null };

const inputClass =
  "h-9 w-full rounded-[9px] border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-200";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "h-9 px-3")}>
      {pending ? "…" : "Добавить"}
    </button>
  );
}

export function AddLeadButton({
  projectId,
  creatives,
}: {
  projectId: string;
  creatives: CreativeOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createLead, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Успех — очищаем поля и сворачиваем панель, чтобы завести следующий с чистого листа.
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
        <Icon name="leads" className="h-4 w-4" /> Добавить лид
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
          <h2 className="text-[15px] font-semibold text-ink">Новый лид</h2>
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
            <span className="text-[12px] text-faint">Имя</span>
            <input name="full_name" placeholder="Как зовут клиента" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">Телефон</span>
            <input name="phone" placeholder="+7…" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">Источник</span>
            <select name="source" defaultValue="whatsapp" className={inputClass}>
              <option value="whatsapp">WhatsApp</option>
              <option value="meta">Meta (Instagram/Facebook)</option>
              <option value="tiktok">TikTok</option>
              <option value="other">Другое</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-faint">Креатив (по UTM-метке)</span>
            <select name="creative_id" defaultValue="" className={inputClass}>
              <option value="">— без привязки —</option>
              {creatives.map((creative) => (
                <option key={creative.id} value={creative.id}>
                  {creative.label} · {creative.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-faint">
              {creatives.length === 0
                ? "Задайте UTM-метки креативам в «Аналитике креативов», чтобы выбирать их здесь."
                : "Метку клиент прислал в первом сообщении — по ней чек привяжется к креативу."}
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
