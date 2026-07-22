import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { issueLinkCode, unlinkTelegram } from "@/lib/actions/telegram";
import { requireSectionAccess } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/domain";
import { formatDate, formatNumber, plural } from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadTelegramState, type TelegramMemberRow } from "@/lib/queries/telegram";

import { ConnectCard } from "./connect-card";

/** Настройки → Telegram-бот (ТЗ, раздел 7): привязка сотрудников к боту платформы. */
export default async function TelegramSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ role, canManage }, state] = await Promise.all([
    requireSectionAccess(projectId, "settings-telegram"),
    loadTelegramState(projectId),
  ]);

  const mayManage = canManage || role === "director";

  const columns: Column<TelegramMemberRow>[] = [
    {
      key: "member",
      header: "Сотрудник",
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{row.fullName}</span>
          <span className="mt-0.5 block text-[11.5px] text-faint">{ROLE_LABELS[row.role]}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус",
      render: (row) =>
        row.status === "linked" ? (
          <Badge tone="brand">Подключён</Badge>
        ) : row.status === "pending" ? (
          <Badge tone="warning">Код выдан</Badge>
        ) : (
          <Badge tone="muted">Нет кода</Badge>
        ),
    },
    {
      key: "code",
      header: "Код привязки",
      hideOnMobile: true,
      render: (row) =>
        row.status === "pending" && row.code ? (
          <span className="tabular font-semibold text-ink">{row.code}</span>
        ) : row.status === "linked" ? (
          <span className="text-muted">{row.username ? `@${row.username}` : "чат привязан"}</span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: "when",
      header: "Подключён",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-faint">
          {row.linkedAt ? formatDate(row.linkedAt) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        mayManage ? (
          <div className="flex justify-end gap-2">
            <form action={issueLinkCode}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="user_id" value={row.userId} />
              <Button type="submit" size="sm" variant="secondary">
                {row.status === "none" ? "Выдать код" : "Новый код"}
              </Button>
            </form>
            {row.status !== "none" ? (
              <form action={unlinkTelegram}>
                <input type="hidden" name="project_id" value={projectId} />
                <input type="hidden" name="user_id" value={row.userId} />
                <Button type="submit" size="sm" variant="ghost">
                  Отключить
                </Button>
              </form>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("settings-telegram")}
        title="Telegram-бот"
        subtitle={`${formatNumber(state.linked)} из ${formatNumber(state.members.length)} ${plural(state.members.length, ["сотрудника", "сотрудников", "сотрудников"])} подключено к боту`}
      />

      <ConnectCard
        projectId={projectId}
        endpoint={state.endpoint}
        hint={state.hint}
        receivedCount={state.receivedCount}
        lastReceivedAt={state.lastReceivedAt ? formatDate(state.lastReceivedAt) : null}
        botConnected={state.botConnected}
        botName={state.botName}
        mayManage={mayManage}
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={state.members}
          rowKey={(row) => row.userId}
          empty={{
            icon: "people",
            title: "В проекте пока нет сотрудников",
            text: "Добавьте их в «Настройки → Сотрудники», и здесь появятся коды привязки.",
          }}
        />
      </div>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Как подключить сотрудника: выдайте ему код, он открывает бота и отправляет этот код
        одним сообщением. Код одноразовый и действует только в этом проекте — переписка с
        паролями не нужна. Кнопка «Новый код» сбрасывает прежнюю привязку.
      </p>
    </main>
  );
}
