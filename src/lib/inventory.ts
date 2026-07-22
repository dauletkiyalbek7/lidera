import type { Tables } from "./database.types";

/**
 * Складские показатели ниши ecommerce (ТЗ, раздел 6.2).
 * Считаются в одном месте — как и остальные производные метрики.
 */

export type Product = Tables<"products">;

export type InventoryTotals = {
  /** Позиций в каталоге. */
  skuCount: number;
  /** Единиц на складе суммарно. */
  unitsInStock: number;
  /** Позиций, где остаток ниже порога. */
  lowStockCount: number;
  /** Позиций, которых нет совсем. */
  outOfStockCount: number;
  /** Себестоимость склада: во что обошёлся текущий остаток. */
  stockCost: number;
  /** Розничная стоимость остатка. */
  retailValue: number;
  /** Потенциальная валовая прибыль, если распродать остаток. */
  potentialMargin: number;
};

export function isLowStock(product: Product): boolean {
  return product.stock_quantity > 0 && product.stock_quantity <= product.low_stock_threshold;
}

export function isOutOfStock(product: Product): boolean {
  return product.stock_quantity <= 0;
}

/** Маржа позиции в деньгах: цена продажи минус себестоимость. */
export function productMargin(product: Product): number {
  return Number(product.sale_price) - Number(product.cost_price);
}

/** Наценка позиции долей от цены продажи; null, если цена не задана. */
export function productMarginRate(product: Product): number | null {
  const price = Number(product.sale_price);
  if (!price) return null;
  return productMargin(product) / price;
}

export function summarizeInventory(products: readonly Product[]): InventoryTotals {
  return products.reduce<InventoryTotals>(
    (totals, product) => {
      const quantity = Math.max(0, product.stock_quantity);
      const cost = quantity * Number(product.cost_price);
      const retail = quantity * Number(product.sale_price);

      return {
        skuCount: totals.skuCount + 1,
        unitsInStock: totals.unitsInStock + quantity,
        lowStockCount: totals.lowStockCount + (isLowStock(product) ? 1 : 0),
        outOfStockCount: totals.outOfStockCount + (isOutOfStock(product) ? 1 : 0),
        stockCost: totals.stockCost + cost,
        retailValue: totals.retailValue + retail,
        potentialMargin: totals.potentialMargin + (retail - cost),
      };
    },
    {
      skuCount: 0,
      unitsInStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      stockCost: 0,
      retailValue: 0,
      potentialMargin: 0,
    },
  );
}
