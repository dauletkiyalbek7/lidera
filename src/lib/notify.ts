import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { readIntegrationCredentialsAsPlatform } from "@/lib/queries/integrations";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Уведомления сотрудникам в Telegram (ТЗ, раздел 7).
 *
 * Событие в CRM — новый лид или закрытая продажа — падает привязанным
 * сотрудникам в бот. Кому падает, решает роль: руководители видят всё по
 * проекту, ответственный менеджер — своё. Сбой Telegram не должен ронять
 * создание лида, поэтому всё обёрнуто и ошибки проглатываются.
 */

type Admin = SupabaseClient<Database>;

/** Руководители проекта — им идут все события. */
const OVERSEER_ROLES = new Set(["director", "rop"]);

/**
 * Кому слать: chat_id привязанных сотрудников.
 * Всегда — руководителям; плюс конкретному человеку (ответственному менеджеру
 * или продавцу), даже если он рядовой. Дубли по chat_id убираем.
 */
async function resolveRecipients(
  admin: Admin,
  projectId: string,
  includeUserId: string | null,
): Promise<string[]> {
  const [accountsResult, membersResult] = await Promise.all([
    admin
      .from("telegram_accounts")
      .select("user_id, chat_id")
      .eq("project_id", projectId)
      .eq("status", "linked"),
    admin
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId)
      .eq("status", "active"),
  ]);

  const roleByUser = new Map((membersResult.data ?? []).map((row) => [row.user_id, row.role]));

  const chats = new Set<string>();
  for (const account of accountsResult.data ?? []) {
    if (!account.chat_id) continue;
    const role = roleByUser.get(account.user_id);
    const isOverseer = role ? OVERSEER_ROLES.has(role) : false;
    if (isOverseer || account.user_id === includeUserId) {
      chats.add(account.chat_id);
    }
  }
  return [...chats];
}

async function broadcast(
  admin: Admin,
  projectId: string,
  includeUserId: string | null,
  text: string,
): Promise<void> {
  try {
    const credentials = await readIntegrationCredentialsAsPlatform(projectId, "telegram");
    if (!credentials) return;

    const chats = await resolveRecipients(admin, projectId, includeUserId);
    await Promise.all(chats.map((chatId) => sendTelegramMessage(credentials.token, chatId, text)));
  } catch {
    // Уведомление — не критичный путь: молчим, чтобы не сорвать создание лида.
  }
}

export type NewLeadNotice = {
  fullName: string;
  phone: string | null;
  source: string | null;
  assignedTo: string | null;
  adHeadline: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  meta: "Meta",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  site: "сайт",
  other: "другое",
};

export async function notifyNewLead(
  admin: Admin,
  projectId: string,
  lead: NewLeadNotice,
): Promise<void> {
  const parts = [`🆕 Новый лид: ${lead.fullName}`];
  if (lead.phone) parts.push(`Телефон: ${lead.phone}`);
  if (lead.source) parts.push(`Источник: ${SOURCE_LABELS[lead.source] ?? lead.source}`);
  if (lead.adHeadline) parts.push(`Объявление: ${lead.adHeadline}`);
  await broadcast(admin, projectId, lead.assignedTo, parts.join("\n"));
}

export type LeadWonNotice = {
  fullName: string;
  assignedTo: string | null;
};

export async function notifyLeadWon(
  admin: Admin,
  projectId: string,
  lead: LeadWonNotice,
): Promise<void> {
  await broadcast(
    admin,
    projectId,
    lead.assignedTo,
    `💰 Лид купил курс: ${lead.fullName}`,
  );
}
