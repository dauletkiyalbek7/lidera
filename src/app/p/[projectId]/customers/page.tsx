import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { StatStrip } from "@/components/metrics/stat-strip";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import {
  formatDate,
  formatDateRange,
  formatMoney,
  formatMoneyOrDash,
  formatNumber,
  plural,
} from "@/lib/format";
import { loadCustomers, loadSales } from "@/lib/queries/crm";

type CustomerRow = {
  id: string;
  fullName: string;
  phone: string | null;
  firstPurchaseAt: string | null;
  ltv: number;
  periodAmount: number;
  periodCount: number;
  products: string[];
};

/** Клиенты: что купили, на какие суммы и общий LTV (ТЗ, Блок 2). */
export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные раздела независимы — уходят одной параллельной волной.
  const [{ project }, customers, sales] = await Promise.all([
    requireSectionAccess(projectId, "customers"),
    loadCustomers(projectId),
    loadSales(projectId, range),
  ]);

  const currency = project.currency;

  const purchases = new Map<string, { amount: number; count: number; products: Set<string> }>();
  for (const sale of sales) {
    if (!sale.customer_id) continue;
    const current = purchases.get(sale.customer_id) ?? {
      amount: 0,
      count: 0,
      products: new Set<string>(),
    };
    current.amount += Number(sale.amount);
    current.count += 1;
    if (sale.product) current.products.add(sale.product);
    purchases.set(sale.customer_id, current);
  }

  const rows: CustomerRow[] = customers
    .filter((customer) => purchases.has(customer.id))
    .map((customer) => {
      const purchase = purchases.get(customer.id)!;
      return {
        id: customer.id,
        fullName: customer.full_name,
        phone: customer.phone,
        firstPurchaseAt: customer.first_purchase_at,
        ltv: Number(customer.total_spent),
        periodAmount: purchase.amount,
        periodCount: purchase.count,
        products: [...purchase.products],
      };
    })
    .sort((a, b) => b.periodAmount - a.periodAmount);

  const periodRevenue = rows.reduce((sum, row) => sum + row.periodAmount, 0);
  const totalLtv = customers.reduce((sum, customer) => sum + Number(customer.total_spent), 0);

  const stats = [
    {
      key: "period",
      label: "Клиентов за период",
      value: formatNumber(rows.length),
      accent: true,
    },
    {
      key: "revenue",
      label: "Сумма покупок за период",
      value: formatMoney(periodRevenue, currency),
    },
    {
      key: "all",
      label: "Всего клиентов",
      value: formatNumber(customers.length),
      hint: "за всё время",
    },
    {
      key: "ltv",
      label: "Средний LTV",
      value: formatMoneyOrDash(customers.length ? totalLtv / customers.length : null, currency),
    },
  ];

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Клиент",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{row.fullName}</span>
          <span className="text-[11.5px] text-faint">{row.phone ?? "телефон не указан"}</span>
        </div>
      ),
    },
    {
      key: "products",
      header: "Что купил",
      hideOnMobile: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-muted">{row.products.join(", ") || "—"}</span>
          <span className="text-[11.5px] text-faint">
            {formatNumber(row.periodCount)}{" "}
            {plural(row.periodCount, ["покупка", "покупки", "покупок"])} за период
          </span>
        </div>
      ),
    },
    {
      key: "first",
      header: "Первая покупка",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">
          {row.firstPurchaseAt ? formatDate(row.firstPurchaseAt) : "—"}
        </span>
      ),
    },
    {
      key: "period",
      header: "За период",
      align: "right",
      render: (row) => (
        <span className="tabular text-muted">{formatMoney(row.periodAmount, currency)}</span>
      ),
    },
    {
      key: "ltv",
      header: "LTV",
      align: "right",
      render: (row) => (
        <span className="tabular font-semibold text-ink">{formatMoney(row.ltv, currency)}</span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("customers")}
        title="Клиенты"
        subtitle={`Купившие · ${formatDateRange(range.from, range.to)}`}
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
        <StatStrip stats={stats} />
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={{
            icon: "customers",
            title: "За период покупок нет",
            text: "Клиент попадает сюда после первой продажи. Общая сумма покупок (LTV) считается за всё время, а не за выбранный период.",
          }}
        />
      </div>
    </main>
  );
}
