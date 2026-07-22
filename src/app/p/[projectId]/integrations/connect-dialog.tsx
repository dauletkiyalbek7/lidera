"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { connectIntegration, type IntegrationFormState } from "@/lib/actions/integrations";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: IntegrationFormState = { error: null, saved: false };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

export type ConnectDialogProvider = {
  key: string;
  title: string;
  secretLabel: string;
  secretPlaceholder: string;
  accountLabel?: string;
  accountPlaceholder?: string;
  where: string;
};

function SubmitButton({ connected }: { connected: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохраняем…" : connected ? "Обновить ключ" : "Подключить"}
    </Button>
  );
}

export function ConnectIntegrationDialog({
  projectId,
  provider,
  connected,
  currentAccount,
}: {
  projectId: string;
  provider: ConnectDialogProvider;
  connected: boolean;
  currentAccount: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(connectIntegration, INITIAL_STATE);
  const [lastSaved, setLastSaved] = useState(state.saved);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Ключ сохранён — закрываем окно, правя состояние во время рендера.
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
      <Button
        size="sm"
        variant={connected ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        {connected ? (
          "Обновить ключ"
        ) : (
          <>
            <Icon name="plug" className="h-4 w-4" />
            Подключить
          </>
        )}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 px-4 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Подключение: ${provider.title}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="card w-full max-w-[520px] p-6 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">
                  {provider.title}
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  Ключ шифруется на сервере и в браузер не возвращается. Показывать его потом
                  платформа не умеет — только заменить.
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
              <input type="hidden" name="provider" value={provider.key} />

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">{provider.secretLabel}</span>
                <input
                  ref={firstFieldRef}
                  name="secret"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  minLength={8}
                  placeholder={provider.secretPlaceholder}
                  className={FIELD_CLASS}
                />
                <span className="text-[12px] text-faint">Где взять: {provider.where}</span>
              </label>

              {provider.accountLabel ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">
                    {provider.accountLabel}{" "}
                    <span className="text-faint">— необязательно</span>
                  </span>
                  <input
                    name="account"
                    autoComplete="off"
                    spellCheck={false}
                    defaultValue={currentAccount ?? ""}
                    placeholder={provider.accountPlaceholder}
                    className={FIELD_CLASS}
                  />
                  <span className="text-[12px] text-faint">
                    Это не секрет — виден команде проекта.
                  </span>
                </label>
              ) : null}

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
                <SubmitButton connected={connected} />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
