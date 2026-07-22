import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabasePublicConfig } from "./config";
import type { Database } from "@/lib/database.types";

/**
 * Серверный клиент под сессией текущего пользователя.
 * Все чтения проходят через RLS — чужой проект физически не вернётся.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabasePublicConfig.url,
    supabasePublicConfig.publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Вызов из Server Component: обновление сессии берёт на себя proxy.ts.
          }
        },
      },
    },
  );
}
