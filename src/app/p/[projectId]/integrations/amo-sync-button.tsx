"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Импорт сделок amoCRM по кнопке. Зовёт серверный маршрут и показывает итог
 * (сколько сделок пришло) или ошибку — прямо в карточке интеграции.
 */
export function AmoSyncButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  function run() {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/sync-amocrm`, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (res.ok && !data.error) {
          setNote({ text: data.message ?? "Готово.", ok: true });
          router.refresh();
        } else {
          setNote({ text: data.error ?? "Не удалось импортировать.", ok: false });
        }
      } catch {
        setNote({ text: "Сеть недоступна. Попробуйте ещё раз.", ok: false });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={run} disabled={pending}>
        {pending ? "Импорт…" : "Синхронизировать"}
      </Button>
      {note ? (
        <span className={`text-[12px] ${note.ok ? "text-brand-700" : "text-rose-600"}`}>
          {note.text}
        </span>
      ) : null}
    </div>
  );
}
