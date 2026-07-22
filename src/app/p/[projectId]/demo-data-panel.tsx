"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { seedDemoData, type DemoDataState } from "@/lib/actions/demo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: DemoDataState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Icon name="sparkle" className="h-[18px] w-[18px]" />
      {pending ? "Заполняем…" : "Заполнить демо-данными"}
    </Button>
  );
}

/**
 * Пустой проект: предлагаем сгенерировать демо-данные, чтобы посмотреть дашборд.
 * Реальные данные потом придут в те же таблицы.
 */
export function DemoDataPanel({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(seedDemoData, INITIAL_STATE);

  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 border-dashed p-5">
      <div className="flex items-start gap-3.5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-brand">
          <Icon name="chart" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">В проекте пока нет данных</h2>
          <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-muted">
            {canManage
              ? "Можно заполнить проект демо-цифрами за 90 дней и посмотреть, как выглядит дашборд. Позже реальные данные из Meta и TikTok придут в те же таблицы — интерфейс не изменится."
              : "Данные появятся, когда владелец проекта подключит рекламные кабинеты или заполнит CRM."}
          </p>
          {state.message ? (
            <p className="mt-2 text-[13px] font-medium text-brand-700">{state.message}</p>
          ) : null}
          {state.error ? (
            <p className="mt-2 text-[13px] font-medium text-rose-600">{state.error}</p>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <form action={formAction}>
          <input type="hidden" name="project_id" value={projectId} />
          <SubmitButton />
        </form>
      ) : null}
    </div>
  );
}
