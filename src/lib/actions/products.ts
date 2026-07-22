"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProductFormState = { error: string | null; saved: boolean };

const MAX_STOCK = 1_000_000;

function readNumber(formData: FormData, name: string): number {
  const value = Number(String(formData.get(name) ?? "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Добавление товара в каталог склада (ТЗ, раздел 6.2). */
export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { niche, canManage, user } = await requireProjectContext(projectId);

  if (niche !== "ecommerce") {
    return { error: "Склад есть только у проектов ниши «Товарка».", saved: false };
  }
  if (!canManage) {
    return { error: "Добавлять товары может владелец или директор проекта.", saved: false };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return { error: "Укажите название товара.", saved: false };
  }

  const costPrice = readNumber(formData, "cost_price");
  const salePrice = readNumber(formData, "sale_price");
  if (salePrice < costPrice) {
    return { error: "Цена продажи не может быть ниже себестоимости.", saved: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("products").insert({
    project_id: projectId,
    name,
    sku: String(formData.get("sku") ?? "").trim() || null,
    stock_quantity: Math.min(MAX_STOCK, Math.round(readNumber(formData, "stock_quantity"))),
    cost_price: costPrice,
    sale_price: salePrice,
    low_stock_threshold: Math.round(readNumber(formData, "low_stock_threshold")) || 5,
  });

  if (error) {
    return { error: "Не удалось сохранить товар. Попробуйте ещё раз.", saved: false };
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "product.created",
    details: { name },
  });

  revalidatePath(`/p/${projectId}/products`);
  revalidatePath(`/p/${projectId}`);
  return { error: null, saved: true };
}

/** Правка остатка прямо в таблице: приход товара или списание. */
export async function updateProductStock(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");

  const { canManage, user } = await requireProjectContext(projectId);
  if (!canManage) return;

  const quantity = Math.min(MAX_STOCK, Math.round(readNumber(formData, "stock_quantity")));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("products")
    .update({ stock_quantity: quantity })
    .eq("id", productId)
    .eq("project_id", projectId);

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "product.stock_changed",
    details: { product_id: productId, stock_quantity: quantity },
  });

  revalidatePath(`/p/${projectId}/products`);
  revalidatePath(`/p/${projectId}`);
}
