"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createEmployee, type EmployeeFormState } from "@/lib/actions/employees";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ROLE_DUTIES, ROLE_LABELS, type ProjectRole } from "@/lib/domain";
import { cn } from "@/lib/cn";

const INITIAL_STATE: EmployeeFormState = { error: null, created: null };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Создаём доступ…" : "Принять на работу"}
    </Button>
  );
}

/** Выданные доступы показываем один раз — второй раз пароль взять неоткуда. */
function Credentials({
  created,
  onClose,
}: {
  created: NonNullable<EmployeeFormState["created"]>;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] bg-brand-50 px-4 py-3.5">
        <p className="text-[13px] font-medium text-brand-700">
          {created.fullName} принят на роль «{created.role}»
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-brand-700/80">
          Передайте доступы сотруднику. Пароль показывается один раз — потом его можно будет
          только сменить.
        </p>
      </div>

      <dl className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3.5 py-2.5">
          <dt className="text-[12px] text-muted">Логин</dt>
          <dd className="truncate text-[13px] font-medium text-ink">{created.login}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3.5 py-2.5">
          <dt className="text-[12px] text-muted">Пароль</dt>
          <dd className="tabular text-[13px] font-medium text-ink">{created.password}</dd>
        </div>
      </dl>

      <div className="flex justify-end border-t border-line pt-4">
        <Button type="button" onClick={onClose}>
          Записал, закрыть
        </Button>
      </div>
    </div>
  );
}

export function AddEmployeeDialog({
  projectId,
  roles,
  disabledReason,
}: {
  projectId: string;
  roles: ProjectRole[];
  disabledReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ProjectRole>(roles[0] ?? "manager");
  const [state, formAction] = useActionState(createEmployee, INITIAL_STATE);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || state.created) return;
    firstFieldRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, state.created]);

  if (disabledReason) {
    return (
      <span className="text-[12px] leading-relaxed text-amber-700" role="note">
        {disabledReason}
      </span>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-[18px] w-[18px]" />
        Добавить сотрудника
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 px-4 py-10 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Приём сотрудника"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="card w-full max-w-[520px] p-6 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">
                  {state.created ? "Доступы сотрудника" : "Новый сотрудник"}
                </h2>
                {!state.created ? (
                  <p className="mt-1 text-[13px] text-muted">
                    Платформа сама создаст логин и пароль для входа.
                  </p>
                ) : null}
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

            <div className="mt-6">
              {state.created ? (
                <Credentials created={state.created} onClose={() => setOpen(false)} />
              ) : (
                <form action={formAction} className="flex flex-col gap-5">
                  <input type="hidden" name="project_id" value={projectId} />
                  <input type="hidden" name="role" value={role} />

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-muted">Фамилия и имя</span>
                    <input
                      ref={firstFieldRef}
                      name="full_name"
                      required
                      minLength={3}
                      placeholder="Например: Ержанова Мадина"
                      className={FIELD_CLASS}
                    />
                  </label>

                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-[13px] font-medium text-muted">Роль</legend>
                    <div className="flex flex-col gap-2">
                      {roles.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRole(value)}
                          aria-pressed={role === value}
                          className={cn(
                            "rounded-[12px] border px-3.5 py-3 text-left transition",
                            role === value
                              ? "border-brand bg-brand-50/60"
                              : "border-line bg-surface hover:border-brand-200",
                          )}
                        >
                          <span className="block text-[13px] font-semibold text-ink">
                            {ROLE_LABELS[value]}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-faint">
                            {ROLE_DUTIES[value]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

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
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
