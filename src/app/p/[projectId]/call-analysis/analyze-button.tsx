"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { analyzeCallAction } from "@/lib/actions/calls";

/** Разобрать/переразобрать звонок: зовёт AI и обновляет строку. */
export function AnalyzeButton({
  projectId,
  callId,
  label,
}: {
  projectId: string;
  callId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeCallAction(projectId, callId);
      if (!result.ok) setError(result.error ?? "Не вышло.");
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-[8px] bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
      >
        {pending ? "Разбор…" : label}
      </button>
      {error ? <span className="max-w-[180px] text-right text-[11px] text-rose-600">{error}</span> : null}
    </span>
  );
}
