import "server-only";

import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_USERS_PER_PAGE = 1000;

/**
 * Логины сотрудников живут в Supabase Auth, а не в profiles,
 * поэтому читаем их сервисным ключом — только на сервере и только для показа владельцу.
 * Без ключа возвращаем пустую карту: страница покажет прочерк вместо логина.
 */
export const loadLogins = cache(async (): Promise<Map<string, string>> => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Map();

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: MAX_USERS_PER_PAGE });
    if (error || !data) return new Map();
    return new Map(data.users.map((user) => [user.id, user.email ?? ""]));
  } catch {
    return new Map();
  }
});

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
