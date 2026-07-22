import { PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { setContractStatus } from "@/lib/actions/hr";
import { requireSectionAccess } from "@/lib/auth";
import { today } from "@/lib/date-range";
import { currencySymbol, formatDate, formatMoney, formatNumber } from "@/lib/format";
import {
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUS_LABELS,
  isContractKind,
  isContractStatus,
  type ContractStatus,
} from "@/lib/hr";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMembers } from "@/lib/queries/crm";
import { loadContracts } from "@/lib/queries/hr";
import type { Tables } from "@/lib/database.types";

import { AddContractDialog } from "./add-contract-dialog";

const STATUS_TONES: Record<ContractStatus, "positive" | "muted" | "warning" | "negative"> = {
  active: "positive",
  draft: "muted",
  expired: "warning",
  terminated: "negative",
};

/** Сколько дней до конца договора считаем «скоро истекает». */
const EXPIRING_SOON_DAYS = 30;

/** Договоры: карточки без файлов (ТЗ, Блок 5). */
export default async function ContractsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ project, role, canManage }, contracts, members] = await Promise.all([
    requireSectionAccess(projectId, "contracts"),
    loadContracts(projectId),
    loadMembers(projectId),
  ]);

  const currency = project.currency;
  const mayManage = canManage || role === "director";
  const memberNames = new Map(members.map((member) => [member.userId, member.fullName]));

  const currentDate = today();
  const soonLimit = new Date(Date.parse(`${currentDate}T00:00:00Z`) + EXPIRING_SOON_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  const active = contracts.filter((row) => row.status === "active");
  const expiringSoon = active.filter(
    (row) => row.ends_on && row.ends_on >= currentDate && row.ends_on <= soonLimit,
  );
  const overdue = active.filter((row) => row.ends_on && row.ends_on < currentDate);
  const totalAmount = active.reduce((sum, row) => sum + Number(row.amount), 0);

  const stats = [
    { key: "all", label: "Всего договоров", value: formatNumber(contracts.length) },
    { key: "active", label: "Действующих", value: formatNumber(active.length), accent: true },
    {
      key: "soon",
      label: "Истекают в ближайший месяц",
      value: formatNumber(expiringSoon.length),
      hint: overdue.length > 0 ? `${formatNumber(overdue.length)} уже просрочено` : "просрочек нет",
    },
    { key: "amount", label: "Сумма действующих", value: formatMoney(totalAmount, currency) },
  ];

  const columns: Column<Tables<"contracts">>[] = [
    {
      key: "title",
      header: "Договор",
      render: (row) => (
        <div>
          <span className="font-medium text-ink">{row.title}</span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            {row.number ? `№ ${row.number} · ` : ""}
            {isContractKind(row.kind) ? CONTRACT_KIND_LABELS[row.kind] : row.kind}
          </span>
        </div>
      ),
    },
    {
      key: "side",
      header: "Вторая сторона",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-muted">
          {row.user_id ? (memberNames.get(row.user_id) ?? "Сотрудник") : (row.counterparty ?? "—")}
        </span>
      ),
    },
    {
      key: "period",
      header: "Срок",
      hideOnMobile: true,
      render: (row) => {
        const expired = row.ends_on && row.ends_on < currentDate && row.status === "active";
        return (
          <span className={`tabular ${expired ? "text-negative" : "text-muted"}`}>
            {row.starts_on ? formatDate(row.starts_on) : "—"}
            {row.ends_on ? ` — ${formatDate(row.ends_on)}` : ""}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Статус",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isContractStatus(row.status) ? STATUS_TONES[row.status] : "muted"}>
            {isContractStatus(row.status) ? CONTRACT_STATUS_LABELS[row.status] : row.status}
          </Badge>
          {mayManage && row.status === "active" ? (
            <form action={setContractStatus}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="contract_id" value={row.id} />
              <input type="hidden" name="status" value="terminated" />
              <Button type="submit" size="sm" variant="ghost">
                Расторгнуть
              </Button>
            </form>
          ) : null}
          {mayManage && row.status === "terminated" ? (
            <form action={setContractStatus}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="contract_id" value={row.id} />
              <input type="hidden" name="status" value="active" />
              <Button type="submit" size="sm" variant="ghost">
                Вернуть в работу
              </Button>
            </form>
          ) : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Сумма",
      align: "right",
      render: (row) => (
        <span className="tabular font-semibold text-ink">
          {formatMoney(Number(row.amount), currency)}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("contracts")}
        title="Договоры"
        subtitle="Карточки договоров с сотрудниками, клиентами и поставщиками"
        actions={
          mayManage ? (
            <AddContractDialog
              projectId={projectId}
              staff={members
                .filter((member) => member.status === "active")
                .map((member) => ({ id: member.userId, name: member.fullName }))}
              currencyLabel={currencySymbol(currency)}
            />
          ) : null
        }
      />

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={contracts}
          rowKey={(row) => row.id}
          empty={{
            icon: "contract",
            title: "Договоров пока нет",
            text: mayManage
              ? "Добавьте карточку договора: номер, стороны, сроки и сумма. Файлы платформа не хранит — только реквизиты."
              : "Договоры ведёт директор проекта.",
          }}
        />
      </div>
    </main>
  );
}
