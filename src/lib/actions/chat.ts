"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chatHint, generateChatToken, hashChatToken } from "@/lib/chat";
import { hasServiceRoleKey } from "@/lib/queries/employees";

export type ChatTokenState = {
  error: string | null;
  /** Показывается ровно один раз: в базе лежит только отпечаток. */
  token: string | null;
};

/**
 * Выпуск токена вебхука чат-бота (ТЗ, Блок 4).
 * Повторный выпуск отзывает прежний — старый адрес перестаёт работать сразу.
 */
export async function issueChatToken(
  _prevState: ChatTokenState,
  formData: FormData,
): Promise<ChatTokenState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);

  if (!(canManage || role === "director")) {
    return { error: "Токен выпускает владелец или директор проекта.", token: null };
  }
  if (!hasServiceRoleKey()) {
    return { error: "На сервере не задан SUPABASE_SERVICE_ROLE_KEY.", token: null };
  }

  const token = generateChatToken();
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("chat_webhooks").upsert(
    {
      project_id: projectId,
      token_hash: hashChatToken(token),
      hint: chatHint(token),
      received_count: 0,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );

  if (error) {
    return { error: "Не удалось выпустить токен. Попробуйте ещё раз.", token: null };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "chat.token_issued",
    details: { hint: chatHint(token) },
  });

  revalidatePath(`/p/${projectId}/chatbot`);
  return { error: null, token };
}
