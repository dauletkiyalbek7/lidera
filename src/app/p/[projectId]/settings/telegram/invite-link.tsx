"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";

/**
 * Личная ссылка-приглашение сотруднику.
 * Директор жмёт «Скопировать» и отправляет ссылку в мессенджере; сотрудник
 * открывает её — Telegram сам подставляет код в /start, привязка проходит без
 * ручного ввода. Копирование — на клиенте, поэтому компонент отдельный.
 */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Буфер недоступен — ссылку всё равно видно рядом кнопкой «Открыть».
    }
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[12px] text-muted transition hover:text-ink"
      >
        <Icon name="link" className="h-3.5 w-3.5" />
        Открыть
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-[8px] bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-100"
      >
        <Icon name={copied ? "check" : "send"} className="h-3.5 w-3.5" />
        {copied ? "Скопировано" : "Ссылка"}
      </button>
    </div>
  );
}
