import "server-only";

import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import { normalizeChannel, type ChatChannel } from "@/lib/chat";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/** Данные экрана «Чат-бот» (ТЗ, Блок 4). */

export type ChatConversationRow = {
  id: string;
  channel: ChatChannel;
  contactName: string | null;
  contactPhone: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  leadId: string | null;
};

export type ChannelRow = {
  key: ChatChannel;
  conversations: number;
  withPhone: number;
  leads: number;
};

export type ChatData = {
  endpoint: string;
  hint: string | null;
  receivedCount: number;
  lastReceivedAt: string | null;
  conversations: ChatConversationRow[];
  byChannel: ChannelRow[];
  totals: { conversations: number; messages: number; leads: number };
};

/** Адрес, который вставляют в ChatPlace: берём из заголовков запроса. */
async function webhookEndpoint(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/api/webhooks/chatplace`;
}

const RECENT_LIMIT = 30;

export async function loadChatData(projectId: string, range: DateRange): Promise<ChatData> {
  const endpoint = await webhookEndpoint();
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let conversationsQuery = supabase
    .from("chat_conversations")
    .select("id, channel, contact_name, contact_phone, last_message, last_message_at, message_count, lead_id")
    .eq("project_id", projectId)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (since) conversationsQuery = conversationsQuery.gte("created_at", since);
  if (until) conversationsQuery = conversationsQuery.lt("created_at", until);

  let messagesQuery = supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (since) messagesQuery = messagesQuery.gte("created_at", since);
  if (until) messagesQuery = messagesQuery.lt("created_at", until);

  const [conversationsResult, messagesResult] = await Promise.all([
    conversationsQuery,
    messagesQuery,
  ]);

  const rows = conversationsResult.data ?? [];

  const byChannel = new Map<ChatChannel, ChannelRow>();
  for (const row of rows) {
    const key = normalizeChannel(row.channel);
    const stat = byChannel.get(key) ?? { key, conversations: 0, withPhone: 0, leads: 0 };
    stat.conversations += 1;
    if (row.contact_phone) stat.withPhone += 1;
    if (row.lead_id) stat.leads += 1;
    byChannel.set(key, stat);
  }

  // Токен закрыт RLS наглухо, поэтому читаем его сервисным ключом.
  // Права вызывающего уже проверены страницей.
  let hint: string | null = null;
  let receivedCount = 0;
  let lastReceivedAt: string | null = null;

  if (hasServiceRoleKey()) {
    const { data } = await createSupabaseAdminClient()
      .from("chat_webhooks")
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
    conversations: rows.slice(0, RECENT_LIMIT).map((row) => ({
      id: row.id,
      channel: normalizeChannel(row.channel),
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      messageCount: row.message_count,
      leadId: row.lead_id,
    })),
    byChannel: [...byChannel.values()].sort((a, b) => b.conversations - a.conversations),
    totals: {
      conversations: rows.length,
      messages: messagesResult.count ?? 0,
      leads: rows.filter((row) => row.lead_id).length,
    },
  };
}
