import "server-only";

import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasServiceRoleKey } from "@/lib/queries/employees";
import type { ProjectRole } from "@/lib/domain";

/** Данные экрана «Настройки → Telegram-бот». */

export type TelegramMemberRow = {
  userId: string;
  fullName: string;
  role: ProjectRole;
  code: string | null;
  status: "linked" | "pending" | "none";
  username: string | null;
  linkedAt: string | null;
};

export type TelegramState = {
  endpoint: string;
  hint: string | null;
  receivedCount: number;
  lastReceivedAt: string | null;
  /** Подключён ли сам бот: токен от @BotFather в «Интеграциях». */
  botConnected: boolean;
  botName: string | null;
  members: TelegramMemberRow[];
  linked: number;
};

async function webhookEndpoint(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/api/webhooks/telegram`;
}

function readAccount(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const value = (config as Record<string, unknown>).account;
  return typeof value === "string" && value ? value : null;
}

export async function loadTelegramState(projectId: string): Promise<TelegramState> {
  const endpoint = await webhookEndpoint();
  const supabase = await createSupabaseServerClient();

  const [membersResult, accountsResult, integrationResult] = await Promise.all([
    supabase
      .from("project_members")
      .select("user_id, role, profiles!inner(full_name)")
      .eq("project_id", projectId)
      .eq("status", "active")
      .overrideTypes<{ user_id: string; role: string; profiles: { full_name: string } }[]>(),
    supabase
      .from("telegram_accounts")
      .select("user_id, code, status, username, linked_at")
      .eq("project_id", projectId),
    supabase
      .from("integrations")
      .select("status, config")
      .eq("project_id", projectId)
      .eq("provider", "telegram")
      .maybeSingle(),
  ]);

  const byUser = new Map((accountsResult.data ?? []).map((row) => [row.user_id, row]));

  const members: TelegramMemberRow[] = (membersResult.data ?? [])
    .map((row) => {
      const account = byUser.get(row.user_id);
      return {
        userId: row.user_id,
        fullName: row.profiles.full_name,
        role: row.role as ProjectRole,
        code: account?.code ?? null,
        status: account ? (account.status === "linked" ? "linked" : "pending") : "none",
        username: account?.username ?? null,
        linkedAt: account?.linked_at ?? null,
      } satisfies TelegramMemberRow;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

  // Секрет вебхука закрыт RLS наглухо — читаем его сервисным ключом.
  // Права вызывающего уже проверены страницей.
  let hint: string | null = null;
  let receivedCount = 0;
  let lastReceivedAt: string | null = null;

  if (hasServiceRoleKey()) {
    const { data } = await createSupabaseAdminClient()
      .from("telegram_webhooks")
      .select("hint, received_count, last_received_at")
      .eq("project_id", projectId)
      .maybeSingle();
    hint = data?.hint ?? null;
    receivedCount = data?.received_count ?? 0;
    lastReceivedAt = data?.last_received_at ?? null;
  }

  return {
    endpoint,
    hint,
    receivedCount,
    lastReceivedAt,
    botConnected: integrationResult.data?.status === "connected",
    botName: readAccount(integrationResult.data?.config),
    members,
    linked: members.filter((row) => row.status === "linked").length,
  };
}
