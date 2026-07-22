"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/icon";

/**
 * Обновление рекламы при заходе на раздел.
 * Кнопки больше нет: если цифры старше порога, страница тихо дёргает Meta
 * сама и перерисовывается. Раз в час то же самое делает расписание.
 */

/** Свежее этого не трогаем: незачем ходить в Meta на каждый клик по вкладке. */
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
  const started = useRef(false);
  const [state, setState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    // Время читаем внутри эффекта: во время отрисовки часы трогать нельзя,
    // результат станет непредсказуемым при повторном рендере.
    const stale =
      !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_MINUTES * 60_000;

    if (!enabled || !stale || started.current) return;
    started.current = true;
    setState("running");

    let alive = true;
    fetch(`/api/projects/${projectId}/sync-ads`, { method: "POST" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!alive) return;
        if (response.ok) {
          setState("done");
          router.refresh();
        } else {
          setState("failed");
          setReason(payload.error ?? "Meta не ответила.");
        }
      })
      .catch(() => {
        if (alive) {
          setState("failed");
          setReason("Не удалось связаться с сервером.");
        }
      });

    return () => {
      alive = false;
    };
  }, [enabled, lastSyncedAt, projectId, router]);

  if (state === "idle" || state === "done") return null;

  if (state === "running") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[12px] text-brand-700">
        <Icon name="ads" className="h-3.5 w-3.5 animate-pulse" />
        Обновляем из Meta…
      </span>
    );
  }

  return (
    <span
      role="alert"
      className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] text-rose-600"
    >
      {reason}
    </span>
  );
}
