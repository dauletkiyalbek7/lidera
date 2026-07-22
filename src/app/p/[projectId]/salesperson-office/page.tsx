import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { formatDateRange, formatMoney, formatMoneyOrDash, formatNumber } from "@/lib/format";
import { loadMembers, loadSales } from "@/lib/queries/crm";

type SalespersonRow = {
  id: string;
  name: string;
  fired: boolean;
  sales: number;
  amount: number;
};

/** Кабинет продажника: закрытые продажи курса и показатели (ТЗ, Блок 2). */
export default async function SalespersonOfficePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные раздела независимы — уходят одной параллельной волной.
  const [{ project, role, user }, sales, members] = await Promise.all([
    requireSectionAccess(projectId, "salesperson-office"),
    loadSales(projectId, range),
    loadMembers(projectId),
  ]);

  const currency = project.currency;
  const ownView = role === "salesperson";
  const salespeople = members.filter(
    (member) => member.role === "salesperson" && (!ownView || member.userId === user.id),
  );

  const rows: SalespersonRow[] = salespeople
    .map((person) => {
      const own = sales.filter((sale) => sale.seller_id === person.userId);
      return {
        id: person.userId,
        name: person.fullName,
        fired: person.status === "fired",
        sales: own.length,
        amount: own.reduce((sum, sale) => sum + Number(sale.amount), 0),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const columns: Column<SalespersonRow>[] = [
    {
      key: "name",
      header: "Продажник",
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-ink">{row.name}</span>
          {row.fired ? <Badge tone="muted">Уволен</Badge> : null}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Продажи курса",
      align: "right",
      render: (row) => <span className="tabular text-muted">{formatNumber(row.sales)}</span>,
    },
    {
      key: "average",
      header: "Средний чек",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">
          {formatMoneyOrDash(row.sales ? row.amount / row.sales : null, currency)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Сумма продаж",
      align: "right",
      render: (row) => (
        <span className="tabular font-semibold text-ink">
          {formatMoney(row.amount, currency)}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("salesperson-office")}
        title="Кабинет продажника"
        subtitle={
          ownView
            ? `Мои показатели · ${formatDateRange(range.from, range.to)}`
            : `Продажники проекта · ${formatDateRange(range.from, range.to)}`
        }
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={{
            icon: "office",
            title: "Продажников пока нет",
            text: "Сотрудники добавляются в «Настройки → Сотрудники». Показатели считаются по продажам, закрытым этим сотрудником.",
          }}
        />
      </div>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Проведённые пробные уроки пока считаются на уровне проекта: в схеме нет поля, кто именно
        провёл урок. Добавим его вместе с полноценным разделом пробных уроков — тогда здесь
        появится колонка «Провёл пробных».
      </p>
    </main>
  );
}
