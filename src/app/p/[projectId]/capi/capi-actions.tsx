"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { sendSaleToMeta, skipSaleToMeta } from "@/lib/actions/capi";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * Ручное решение по продаже: отправить событие в Meta или пропустить.
 * Показываем только для того, что ещё не ушло — по решению продажника/руководителя
 * (шлём в рекламу только тёплых и горячих клиентов).
 */
export function CapiActions({
  projectId,
  saleId,
  status,
}: {
  projectId: string;
  saleId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return <span className="text-[12px] text-faint">—</span>;
  }

  function run(action: "send" | "skip") {
    setError(null);
    startTransition(async () => {
      const result =
        action === "send"
          ? await sendSaleToMeta(projectId, saleId)
          : await skipSaleToMeta(projectId, saleId);
      if (!result.ok) setError(result.error ?? "Не вышло.");
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("send")}
        className={cn(
          "inline-flex items-center gap-1 rounded-[8px] bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-100",
          pending ? "opacity-60" : "",
        )}
        title="Отправить событие покупки в Meta"
      >
        <Icon name="send" className="h-3.5 w-3.5" />
        {pending ? "…" : "В Meta"}
      </button>
      {status !== "skipped" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("skip")}
          className="rounded-[8px] px-2 py-1 text-[12px] text-faint transition hover:text-ink"
          title="Не отправлять — холодный клиент"
        >
          Пропустить
        </button>
      ) : null}
      {error ? <span className="text-[11px] text-rose-600">{error}</span> : null}
    </div>
  );
}
