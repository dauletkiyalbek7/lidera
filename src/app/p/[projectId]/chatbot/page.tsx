import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/metrics/metric-card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { CHAT_CHANNEL_LABELS } from "@/lib/chat";
import { readDateRange } from "@/lib/date-range";
import { formatDate, formatDateRange, formatNumber, formatPercent } from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadChatData, type ChannelRow, type ChatConversationRow } from "@/lib/queries/chat";

import { WebhookCard } from "./webhook-card";

/** Чат-бот (ТЗ, Блок 4): переписки ChatPlace и лиды, которые из них выросли. */
export default async function ChatbotPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [{ role, canManage }, data] = await Promise.all([
    requireSectionAccess(projectId, "chatbot"),
    loadChatData(projectId, range),
  ]);

  const mayManage = canManage || role === "director";
  const withPhone = data.conversations.filter((row) => row.contactPhone).length;

  const cards = [
    {
      key: "conversations",
      label: "Переписок",
      icon: "chat" as const,
      value: formatNumber(data.totals.conversations),
      hint: `${formatNumber(data.totals.messages)} сообщений`,
    },
    {
      key: "leads",
      label: "Лидов из чата",
      icon: "leads" as const,
      value: formatNumber(data.totals.leads),
      accent: true,
      hint:
        data.totals.conversations > 0
          ? `${formatPercent(data.totals.leads / data.totals.conversations)} переписок дали номер`
          : undefined,
    },
    {
      key: "waiting",
      label: "Без номера",
      icon: "funnel" as const,
      value: formatNumber(data.totals.conversations - data.totals.leads),
      hint: "переписка есть, телефона пока нет",
    },
  ];

  const channelColumns: Column<ChannelRow>[] = [
    {
      key: "channel",
      header: "Канал",
      render: (row) => (
        <span className="font-medium text-ink">{CHAT_CHANNEL_LABELS[row.key]}</span>
      ),
    },
    {
      key: "conversations",
      header: "Переписок",
      align: "right",
      render: (row) => <span className="tabular text-ink">{formatNumber(row.conversations)}</span>,
    },
    {
      key: "withPhone",
      header: "С номером",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tabular text-muted">{formatNumber(row.withPhone)}</span>,
    },
    {
      key: "leads",
      header: "Лидов",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{formatNumber(row.leads)}</span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            {formatPercent(row.conversations ? row.leads / row.conversations : null)}
          </span>
        </div>
      ),
    },
  ];

  const conversationColumns: Column<ChatConversationRow>[] = [
    {
      key: "contact",
      header: "Собеседник",
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">
            {row.contactName ?? row.contactPhone ?? "Без имени"}
          </span>
          <span className="tabular mt-0.5 block text-[11.5px] text-faint">
            {row.contactPhone ?? "номер не оставлен"}
          </span>
        </div>
      ),
    },
    {
      key: "channel",
      header: "Канал",
      hideOnMobile: true,
      render: (row) => <span className="text-muted">{CHAT_CHANNEL_LABELS[row.channel]}</span>,
    },
    {
      key: "lastMessage",
      header: "Последнее сообщение",
      hideOnMobile: true,
      render: (row) => (
        <span className="block max-w-[360px] truncate text-muted">
          {row.lastMessage ?? "—"}
        </span>
      ),
    },
    {
      key: "messages",
      header: "Сообщений",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tabular text-muted">{formatNumber(row.messageCount)}</span>,
    },
    {
      key: "lead",
      header: "Лид",
      align: "right",
      render: (row) =>
        row.leadId ? (
          <Link href={`/p/${projectId}/leads`}>
            <Badge tone="brand">Заведён</Badge>
          </Link>
        ) : (
          <Badge tone="muted">Ждём номер</Badge>
        ),
    },
    {
      key: "when",
      header: "Когда",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-faint">
          {row.lastMessageAt ? formatDate(row.lastMessageAt) : "—"}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("chatbot")}
        title="Чат-бот"
        subtitle={`Переписки ChatPlace и лиды из них · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <MetricCard
            key={card.key}
            label={card.label}
            value={card.value}
            hint={"hint" in card ? card.hint : undefined}
            icon={card.icon}
            accent={"accent" in card ? card.accent : false}
          />
        ))}
      </section>

      <WebhookCard
        projectId={projectId}
        endpoint={data.endpoint}
        hint={data.hint}
        receivedCount={data.receivedCount}
        lastReceivedAt={data.lastReceivedAt ? formatDate(data.lastReceivedAt) : null}
        mayManage={mayManage}
      />

      <GroupLabel>По каналам</GroupLabel>

      <DataTable
        columns={channelColumns}
        rows={data.byChannel}
        rowKey={(row) => row.key}
        empty={{
          icon: "chat",
          title: "Переписок за период нет",
          text: "Как только ChatPlace начнёт слать события на адрес выше, здесь появится разбивка по каналам.",
        }}
      />

      <GroupLabel>Последние переписки</GroupLabel>

      <DataTable
        columns={conversationColumns}
        rows={data.conversations}
        rowKey={(row) => row.id}
        empty={{
          icon: "chat",
          title: "Пока тихо",
          text: "Здесь будут диалоги: кто написал, в каком канале и оставил ли номер.",
        }}
      />

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Лид заводится один раз на переписку — в момент, когда в ней впервые появился номер.
        Показано {formatNumber(data.conversations.length)}, из них с номером {formatNumber(withPhone)}.
      </p>
    </main>
  );
}
