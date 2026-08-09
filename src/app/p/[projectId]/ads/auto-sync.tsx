"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/lib/format";

/**
 * Свежесть данных рекламы. При заходе тихо обновляет, если цифры устарели, и даёт
 * кнопку «Обновить» — чтобы подтянуть сегодняшний день вручную в любой момент.
 * Раз в сутки то же делает расписание (лимит тарифа Vercel).
 */

/** Свежее этого не трогаем автоматически: незачем ходить в Meta на каждый клик. */
const STALE_MINUTES = 15;

export function AutoSync({
  projectId,
  lastSyncedAt,
  enabled,
}: {
  projectId: string;
  lastSyncedAt: string | null;
  enabled: boolean;
}) {
  const router = useRouter();
  const autoStarted = useRef(false);
  const [state, setState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [reason, setReason] = useState<string | null>(null);

  const runSync = useCallback(() => {
    setState("running");
    setReason(null);
    return fetch(`/api/projects/${projectId}/sync-ads`, { method: "POST" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          skipped?: boolean;
          reason?: string;
        };
        if (response.ok) {
          setState("done");
          if (payload.skipped) setReason(payload.reason ?? "Обновление на паузе.");
          else router.refresh();
        } else {
          setState("failed");
          setReason(payload.error ?? "Meta не ответила.");
        }
      })
      .catch(() => {
        setState("failed");
        setReason("Не удалось связаться с сервером.");
      });
  }, [projectId, router]);

  useEffect(() => {
    const stale =
      !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_MINUTES * 60_000;
    if (!enabled || !stale || autoStarted.current) return;
    autoStarted.current = true;
    void runSync();
  }, [enabled, lastSyncedAt, runSync]);

  if (!enabled) return null;

  if (state === "running") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[12px] text-brand-700">
        <Icon name="ads" className="h-3.5 w-3.5 animate-pulse" />
        Обновляем из Meta…
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void runSync()}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-muted transition hover:border-brand-200 hover:text-brand-700"
        title="Подтянуть свежие данные из Meta, включая сегодня"
      >
        <Icon name="ads" className="h-3.5 w-3.5" />
        Обновить
      </button>
      {state === "failed" && reason ? (
        <span className="text-[11.5px] text-rose-600">{reason}</span>
      ) : lastSyncedAt ? (
        <span className="text-[11.5px] text-faint">данные на {formatDateTime(lastSyncedAt)}</span>
      ) : null}
    </span>
  );
}
