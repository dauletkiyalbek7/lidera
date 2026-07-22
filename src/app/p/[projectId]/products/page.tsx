import { PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import {
  currencySymbol,
  formatMoney,
  formatNumber,
  formatPercent,
  plural,
} from "@/lib/format";
import {
  isLowStock,
  isOutOfStock,
  productMargin,
  productMarginRate,
  summarizeInventory,
  type Product,
} from "@/lib/inventory";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadProducts } from "@/lib/queries/crm";

import { AddProductDialog } from "./add-product-dialog";
import { StockCell } from "./stock-cell";

/** Товары и склад — только для ниши ecommerce (ТЗ, раздел 6.2). */
export default async function ProductsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ project, canManage }, products] = await Promise.all([
    requireSectionAccess(projectId, "products"),
    loadProducts(projectId),
  ]);

  const currency = project.currency;
  const totals = summarizeInventory(products);

  const stats = [
    {
      key: "sku",
      label: "Товаров в каталоге",
      value: formatNumber(totals.skuCount),
      accent: true,
    },
    {
      key: "units",
      label: "Единиц на складе",
      value: formatNumber(totals.unitsInStock),
    },
    {
      key: "low",
      label: "Заканчиваются",
      value: formatNumber(totals.lowStockCount),
      hint:
        totals.outOfStockCount > 0
          ? `${formatNumber(totals.outOfStockCount)} ${plural(totals.outOfStockCount, ["позиция", "позиции", "позиций"])} не в наличии`
          : "все позиции в наличии",
    },
    {
      key: "cost",
      label: "Себестоимость склада",
      value: formatMoney(totals.stockCost, currency),
      hint: `в рознице ${formatMoney(totals.retailValue, currency)}`,
    },
  ];

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Товар",
      render: (product) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{product.name}</span>
          <span className="text-[11.5px] text-faint">{product.sku ?? "без артикула"}</span>
        </div>
      ),
    },
    {
      key: "state",
      header: "Наличие",
      render: (product) =>
        isOutOfStock(product) ? (
          <Badge tone="negative">Закончился</Badge>
        ) : isLowStock(product) ? (
          <Badge tone="warning">Заканчивается</Badge>
        ) : (
          <Badge tone="positive">В наличии</Badge>
        ),
    },
    {
      key: "cost",
      header: "Себестоимость",
      align: "right",
      hideOnMobile: true,
      render: (product) => (
        <span className="tabular text-muted">
          {formatMoney(Number(product.cost_price), currency)}
        </span>
      ),
    },
    {
      key: "price",
      header: "Цена продажи",
      align: "right",
      hideOnMobile: true,
      render: (product) => (
        <span className="tabular text-muted">
          {formatMoney(Number(product.sale_price), currency)}
        </span>
      ),
    },
    {
      key: "margin",
      header: "Маржа",
      align: "right",
      hideOnMobile: true,
      render: (product) => (
        <span className="tabular text-ink">
          {formatMoney(productMargin(product), currency)}
          <span className="ml-1.5 text-[11.5px] text-faint">
            {formatPercent(productMarginRate(product))}
          </span>
        </span>
      ),
    },
    {
      key: "stock",
      header: "Остаток",
      align: "right",
      render: (product) =>
        canManage ? (
          <StockCell
            projectId={projectId}
            productId={product.id}
            quantity={product.stock_quantity}
          />
        ) : (
          <span className="tabular font-semibold text-ink">
            {formatNumber(product.stock_quantity)}
          </span>
        ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("products")}
        title="Товары (склад)"
        subtitle="Каталог и остатки на сейчас — поэтому раздел не зависит от выбранного периода"
        actions={
          canManage ? (
            <AddProductDialog
              projectId={projectId}
              currencyLabel={currencySymbol(project.currency)}
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
          rows={products}
          rowKey={(product) => product.id}
          empty={{
            icon: "office",
            title: "Каталог пуст",
            text: "Добавьте товары — платформа посчитает остатки, себестоимость склада и маржу по каждой позиции.",
          }}
        />
      </div>

      {canManage ? (
        <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
          Остаток можно править прямо в таблице: введите новое число и уведите фокус.
        </p>
      ) : null}
    </main>
  );
}
