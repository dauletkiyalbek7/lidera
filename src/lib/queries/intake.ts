import "server-only";

import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/** Состояние приёма заявок для экрана «Ресурсы и воронки» (ТЗ, Блок 3). */

export type IntakeState = {
  endpoint: string;
  hint: string | null;
  receivedCount: number;
  lastReceivedAt: string | null;
};

/** Адрес, который клиент вставит к себе на сайт: берём из заголовков запроса. */
async function intakeEndpoint(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/api/intake`;
}

export async function loadIntakeState(projectId: string): Promise<IntakeState> {
  const endpoint = await intakeEndpoint();

  if (!hasServiceRoleKey()) {
    return { endpoint, hint: null, receivedCount: 0, lastReceivedAt: null };
  }

  // Строка закрыта RLS наглухо, поэтому читаем её сервисным ключом.
  // Права вызывающего уже проверены страницей.
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("lead_intake")
    .select("hint, received_count, last_received_at")
    .eq("project_id", projectId)
    .maybeSingle();

  return {
    endpoint,
    hint: data?.hint ?? null,
    receivedCount: data?.received_count ?? 0,
    lastReceivedAt: data?.last_received_at ?? null,
  };
}
