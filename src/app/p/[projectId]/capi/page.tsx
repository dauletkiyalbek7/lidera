import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { formatDateTime, formatDateRange, formatMoney, formatNumber } from "@/lib/format";
import { loadCapiEvents, loadPixelStatus, type CapiEvent } from "@/lib/queries/capi";

import { CapiActions } from "./capi-actions";

/** Подписи статуса отправки события покупки в Meta. */
const CAPI_META: Record<string, { label: string; tone: "positive" | "warning" | "negative" | "muted" }> = {
  sent: { label: "Отправлено в Meta", tone: "positive" },
  pending: { label: "Ждёт подтверждения чека", tone: "muted" },
  failed: { label: "Ошибка отправки", tone: "negative" },
  skipped: { label: "Пропущено (нет телефона/пикселя)", tone: "warning" },
};

/**
 * CAPI (Conversion API): события покупки, уходящие в рекламный кабинет Meta.
 * Поток: продажник подтверждает чек в Telegram-боте → отсюда видно, что событие
 * ушло. Раздел показывает статус пикселя и журнал отправок (ТЗ, Блок 3).
 */
export default async function CapiPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [{ project, role, canManage }, events, pixel] = await Promise.all([
    requireSectionAccess(projectId, "capi"),
    loadCapiEvents(projectId, range),
    loadPixelStatus(projectId),
  ]);

  const currency = project.currency;
  // Решать отправку могут продажники и руководители — им и показываем кнопки.
  const mayAct =
    canManage || ["director", "rop", "manager", "salesperson"].includes(role);
  const sent = events.filter((event) => event.capiStatus === "sent");
  const pending = events.filter((event) => event.capiStatus === "pending");
  const failed = events.filter((event) => event.capiStatus === "failed");
  const sentAmount = sent.reduce((sum, event) => sum + event.amount, 0);

  const stats = [
    { key: "sent", label: "Ушло в Meta", value: formatNumber(sent.length), accent: true },
    { key: "amount", label: "Сумма отправленных", value: formatMoney(sentAmount, currency) },
    { key: "pending", label: "Ждут чека", value: formatNumber(pending.length) },
    {
      key: "failed",
      label: "Ошибки",
      value: formatNumber(failed.length),
      hint: failed.length > 0 ? "нужно проверить" : "нет",
    },
  ];

  const columns: Column<CapiEvent>[] = [
    {
      key: "client",
      header: "Клиент",
      render: (event) => (
        <div className="flex items-center gap-3">
          <Avatar name={event.client} size="sm" />
          <span className="truncate font-medium text-ink">{event.client}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Сумма",
      hideOnMobile: true,
      render: (event) => (
        <span className="tabular text-muted">{formatMoney(event.amount, currency)}</span>
      ),
    },
    {
      key: "receipt",
      header: "Чек",
      hideOnMobile: true,
      render: (event) =>
        event.receiptStatus === "confirmed" ? (
          <Badge tone="positive">Подтверждён</Badge>
        ) : (
          <Badge tone="warning">Ожидается</Badge>
        ),
    },
    {
      key: "capi",
      header: "Событие в Meta",
      render: (event) => {
        const meta = CAPI_META[event.capiStatus] ?? CAPI_META.pending;
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "when",
      header: "Когда",
      hideOnMobile: true,
      align: "right",
      render: (event) => (
        <span className="tabular text-muted">
          {event.capiAt ? formatDateTime(event.capiAt) : "—"}
        </span>
      ),
    },
    ...(mayAct
      ? [
          {
            key: "action",
            header: "Отправка",
            align: "right" as const,
            render: (event: CapiEvent) => (
              <CapiActions projectId={projectId} saleId={event.id} status={event.capiStatus} />
            ),
          },
        ]
      : []),
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("capi")}
        title="CAPI"
        subtitle={`События покупки в Meta · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      {/* Статус подключения: сразу видно, работает канал или нет. */}
      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-4">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${
              pixel.connected ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            <Icon name="send" className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-ink">Meta Conversions API</h2>
              <Badge tone={pixel.connected ? "positive" : "warning"}>
                <StatusDot tone={pixel.connected ? "positive" : "warning"} />
                {pixel.connected ? "Работает" : "Не настроено"}
              </Badge>
            </div>
            <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-muted">
              {pixel.connected
                ? `Пиксель ${pixel.pixelId} подключён. Как только продажник подтверждает чек в Telegram-боте, событие Purchase автоматически уходит в Meta.`
                : "Укажите Pixel ID в «Интеграциях → Meta», чтобы события покупки уходили в рекламный кабинет."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <StatStrip stats={stats} />
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={events}
          rowKey={(event) => event.id}
          empty={{
            icon: "send",
            title: "За период событий нет",
            text: "Событие покупки появляется здесь после того, как продажник подтвердит чек в Telegram-боте. Отправка идёт в Meta автоматически.",
          }}
        />
      </div>
    </main>
  );
}
