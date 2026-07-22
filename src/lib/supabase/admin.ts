import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabasePublicConfig } from "./config";
import type { Database } from "@/lib/database.types";

/**
 * Административный клиент: обходит RLS, живёт только на сервере.
 * Нужен для операций от имени платформы (создание аккаунтов сотрудников).
 * Каждый вызов обязан сам проверить права текущего пользователя.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Не задан SUPABASE_SERVICE_ROLE_KEY. Добавьте его в .env.local (только на сервере).",
    );
  }

  return createClient<Database>(supabasePublicConfig.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
