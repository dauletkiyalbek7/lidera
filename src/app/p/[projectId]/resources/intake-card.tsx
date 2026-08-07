"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { issueIntakeToken, type IntakeTokenState } from "@/lib/actions/intake";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: IntakeTokenState = { error: null, token: null };

function SubmitButton({ hasToken }: { hasToken: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={hasToken ? "secondary" : "primary"} disabled={pending}>
      {pending ? "Выпускаем…" : hasToken ? "Выпустить новый" : "Выпустить токен"}
    </Button>
  );
}

/** Приём заявок с сайта: токен и короткая статистика. Инструкции убраны — лишнее. */
export function IntakeCard({
  projectId,
  endpoint,
  hint,
  receivedCount,
  lastReceivedAt,
  mayManage,
}: {
  projectId: string;
  endpoint: string;
  hint: string | null;
  receivedCount: number;
  lastReceivedAt: string | null;
  mayManage: boolean;
}) {
  const [state, formAction] = useActionState(issueIntakeToken, INITIAL_STATE);
  const token = state.token;

  return (
    <section className="card mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-brand">
            <Icon name="send" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Приём заявок с сайта</h2>
            <p className="tabular mt-0.5 text-[12px] text-faint">{endpoint}</p>
          </div>
        </div>

        {mayManage ? (
          <form action={formAction}>
            <input type="hidden" name="project_id" value={projectId} />
            <SubmitButton hasToken={Boolean(hint)} />
          </form>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-2.5 border-t border-line pt-4 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-faint">Токен</dt>
          <dd className="tabular mt-0.5 text-ink">{hint ?? "не выпущен"}</dd>
        </div>
        <div>
          <dt className="text-faint">Принято заявок</dt>
          <dd className="tabular mt-0.5 text-ink">{receivedCount}</dd>
        </div>
        <div>
          <dt className="text-faint">Последняя</dt>
          <dd className="mt-0.5 text-ink">{lastReceivedAt ?? "пока не было"}</dd>
        </div>
      </dl>

      {token ? (
        <div className="mt-4 rounded-[12px] bg-brand-50 p-4">
          <p className="text-[12.5px] font-medium text-brand-700">
            Скопируйте токен сейчас — платформа показывает его один раз.
          </p>
          <p className="tabular mt-2 break-all rounded-[10px] bg-surface px-3 py-2 text-[13px] text-ink">
            {token}
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="mt-4 rounded-[12px] bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600"
        >
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
