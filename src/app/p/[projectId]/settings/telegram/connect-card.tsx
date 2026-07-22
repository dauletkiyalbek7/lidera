"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { issueTelegramToken, type TelegramTokenState } from "@/lib/actions/telegram";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: TelegramTokenState = { error: null, token: null };

function SubmitButton({ hasToken }: { hasToken: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={hasToken ? "secondary" : "primary"} disabled={pending}>
      {pending ? "Выпускаем…" : hasToken ? "Выпустить новый" : "Выпустить секрет"}
    </Button>
  );
}

/** Подключение бота: адрес вебхука, секрет и готовая команда для Telegram. */
export function ConnectCard({
  projectId,
  endpoint,
  hint,
  receivedCount,
  lastReceivedAt,
  botConnected,
  botName,
  mayManage,
}: {
  projectId: string;
  endpoint: string;
  hint: string | null;
  receivedCount: number;
  lastReceivedAt: string | null;
  botConnected: boolean;
  botName: string | null;
  mayManage: boolean;
}) {
  const [state, formAction] = useActionState(issueTelegramToken, INITIAL_STATE);
  const token = state.token;

  const command = `curl -X POST "https://api.telegram.org/bot<ТОКЕН_БОТА>/setWebhook" \\
  -d "url=${endpoint}" \\
  -d "secret_token=${token ?? "ВАШ_СЕКРЕТ"}"`;

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-brand">
            <Icon name="send" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Подключение бота</h2>
            <p className="mt-1 max-w-[720px] text-[13px] leading-relaxed text-muted">
              Заведите бота у <code className="text-[12px] text-ink">@BotFather</code>, положите
              его токен в «Интеграции», а потом одной командой скажите Telegram, куда слать
              сообщения. Токен бота остаётся на сервере и в браузер не попадает.
            </p>
          </div>
        </div>

        {mayManage ? (
          <form action={formAction}>
            <input type="hidden" name="project_id" value={projectId} />
            <SubmitButton hasToken={Boolean(hint)} />
          </form>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-2.5 border-t border-line pt-4 text-[13px] sm:grid-cols-4">
        <div className="sm:col-span-2">
          <dt className="text-faint">Адрес вебхука</dt>
          <dd className="tabular mt-0.5 break-all text-ink">{endpoint}</dd>
        </div>
        <div>
          <dt className="text-faint">Секрет</dt>
          <dd className="tabular mt-0.5 text-ink">{hint ?? "не выпущен"}</dd>
        </div>
        <div>
          <dt className="text-faint">Принято обновлений</dt>
          <dd className="tabular mt-0.5 text-ink">{receivedCount}</dd>
        </div>
      </dl>

      {lastReceivedAt ? (
        <p className="mt-2 text-[12px] text-faint">Последнее обновление: {lastReceivedAt}</p>
      ) : null}

      <p className="mt-3 text-[12.5px] text-muted">
        Токен бота:{" "}
        {botConnected ? (
          <span className="font-medium text-brand-700">
            подключён{botName ? ` · ${botName}` : ""}
          </span>
        ) : (
          <span className="text-rose-600">
            не подключён — привязка работает, но бот не сможет ответить сотруднику
          </span>
        )}
      </p>

      {token ? (
        <div className="mt-4 rounded-[12px] bg-brand-50 p-4">
          <p className="text-[12.5px] font-medium text-brand-700">
            Скопируйте секрет сейчас — платформа показывает его один раз.
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

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          Команда для Telegram
        </p>
        <pre className="tabular mt-2 overflow-x-auto rounded-[12px] bg-canvas p-3.5 text-[11.5px] leading-relaxed text-muted">
          {command}
        </pre>
      </div>
    </section>
  );
}
