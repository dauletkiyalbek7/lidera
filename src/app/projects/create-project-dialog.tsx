"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createProject, type CreateProjectState } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { NICHES, NICHE_HINTS, NICHE_LABELS, type Niche } from "@/lib/domain";
import { cn } from "@/lib/cn";

const INITIAL_STATE: CreateProjectState = { error: null };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

const NICHE_ICON: Record<Niche, "trial" | "sales"> = {
  education: "trial",
  ecommerce: "sales",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Создаём…" : "Создать проект"}
    </Button>
  );
}

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [niche, setNiche] = useState<Niche>("education");
  const [state, formAction] = useActionState(createProject, INITIAL_STATE);
  const firstFieldRef = useRef<HTMLInputElement>(null);

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
        Создать проект
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 px-4 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Создание проекта"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="card w-full max-w-[520px] p-6 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">
                  Новый проект
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  Ниша определяет разделы, метрики и воронку проекта.
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
              <input type="hidden" name="niche" value={niche} />

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">Название проекта</span>
                <input
                  ref={firstFieldRef}
                  name="name"
                  required
                  minLength={2}
                  placeholder="Например: Школа английского Speak"
                  className={FIELD_CLASS}
                />
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-[13px] font-medium text-muted">Ниша</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {NICHES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNiche(value)}
                      aria-pressed={niche === value}
                      className={cn(
                        "flex flex-col gap-2 rounded-[14px] border p-4 text-left transition",
                        niche === value
                          ? "border-brand bg-brand-50/60"
                          : "border-line bg-surface hover:border-brand-200",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded-[11px]",
                          niche === value
                            ? "bg-brand text-white"
                            : "bg-canvas text-muted",
                        )}
                      >
                        <Icon name={NICHE_ICON[value]} className="h-[18px] w-[18px]" />
                      </span>
                      <span className="text-[13px] font-semibold text-ink">
                        {NICHE_LABELS[value]}
                      </span>
                      <span className="text-[11px] leading-relaxed text-faint">
                        {NICHE_HINTS[value]}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">Директор проекта</span>
                <input
                  name="director_name"
                  placeholder="ФИО директора"
                  className={FIELD_CLASS}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">
                  Описание <span className="text-faint">— необязательно</span>
                </span>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Пара слов о клиенте и задаче"
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
