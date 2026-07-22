"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { syncMetaAds, type AdsSyncState } from "@/lib/actions/ads";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: AdsSyncState = { error: null, message: null };

function SubmitButton({ connected }: { connected: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending || !connected}>
      <Icon name="ads" className="h-[18px] w-[18px]" />
      {pending ? "Тянем из Meta…" : "Обновить сейчас"}
    </Button>
  );
}

/**
 * Обновление рекламы вручную.
 * Основную работу делает почасовое расписание — эта кнопка на случай,
 * когда ждать час не хочется. Результат и ошибку Meta показываем словами.
 */
export function SyncPanel({
  projectId,
  connected,
}: {
  projectId: string;
  connected: boolean;
}) {
  const [state, formAction] = useActionState(syncMetaAds, INITIAL_STATE);

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction}>
        <input type="hidden" name="project_id" value={projectId} />
        <SubmitButton connected={connected} />
      </form>

      {state.message ? (
        <p className="max-w-[420px] rounded-[10px] bg-brand-50 px-3 py-2 text-right text-[12px] text-brand-700">
          {state.message}
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="max-w-[420px] rounded-[10px] bg-rose-50 px-3 py-2 text-right text-[12px] text-rose-600"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
