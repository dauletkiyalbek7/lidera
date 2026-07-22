"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { issueChatToken, type ChatTokenState } from "@/lib/actions/chat";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INITIAL_STATE: ChatTokenState = { error: null, token: null };

function SubmitButton({ hasToken }: { hasToken: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={hasToken ? "secondary" : "primary"} disabled={pending}>
      {pending ? "Выпускаем…" : hasToken ? "Выпустить новый" : "Подключить"}
    </Button>
  );
}

/** Подключение ChatPlace: адрес вебхука, токен и пример события. */
export function WebhookCard({
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
  const [state, formAction] = useActionState(issueChatToken, INITIAL_STATE);
  const token = state.token;

  const example = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${token ?? "ВАШ_ТОКЕН"}" \\
  -H "Content-Type: application/json" \\
  -d '{"chat_id":"77011234567","channel":"whatsapp","name":"Алия","text":"Здравствуйте, мой номер 8 701 123 45 67"}'`;

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-brand">
            <Icon name="chat" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Подключение ChatPlace</h2>
            <p className="mt-1 max-w-[720px] text-[13px] leading-relaxed text-muted">
              Вставьте этот адрес в ChatPlace как webhook. Каждое входящее сообщение попадёт
              сюда, а как только в переписке появится номер — платформа сама заведёт лид с
              источником канала.
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
          <dt className="text-faint">Токен</dt>
          <dd className="tabular mt-0.5 text-ink">{hint ?? "не выпущен"}</dd>
        </div>
        <div>
          <dt className="text-faint">Принято событий</dt>
          <dd className="tabular mt-0.5 text-ink">{receivedCount}</dd>
        </div>
      </dl>

      {lastReceivedAt ? (
        <p className="mt-2 text-[12px] text-faint">Последнее событие: {lastReceivedAt}</p>
      ) : null}

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

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          Как выглядит событие
        </p>
        <pre className="tabular mt-2 overflow-x-auto rounded-[12px] bg-canvas p-3.5 text-[11.5px] leading-relaxed text-muted">
          {example}
        </pre>
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          Обязателен только <code>chat_id</code> — по нему сообщения складываются в одну
          переписку. Текст принимается как <code>text</code>, <code>message</code> или{" "}
          <code>body</code>; канал — <code>channel</code> или <code>platform</code>. Instagram и
          Facebook считаются источником Meta, WhatsApp — своим.
        </p>
      </div>
    </section>
  );
}
