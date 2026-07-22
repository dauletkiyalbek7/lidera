"use client";

import { useRef } from "react";

import { updateProductStock } from "@/lib/actions/products";

/** Остаток правится прямо в строке: ввели число — оно сохранилось. */
export function StockCell({
  projectId,
  productId,
  quantity,
}: {
  projectId: string;
  productId: string;
  quantity: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateProductStock} className="flex justify-end">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="product_id" value={productId} />
      <input
        type="number"
        name="stock_quantity"
        min={0}
        step={1}
        defaultValue={quantity}
        aria-label="Остаток на складе"
        onBlur={(event) => {
          if (Number(event.target.value) !== quantity) formRef.current?.requestSubmit();
        }}
        className="tabular h-8 w-20 rounded-[9px] border border-line bg-surface px-2 text-right text-[13px] text-ink transition hover:border-brand-200 focus:border-brand-200 focus:outline-none"
      />
    </form>
  );
}
