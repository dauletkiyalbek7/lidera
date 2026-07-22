/** Публичные параметры Supabase. Секретов здесь нет и быть не может. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Не задана переменная окружения ${name}. Скопируйте .env.example в .env.local и заполните значения.`,
    );
  }
  return value;
}

export const supabasePublicConfig = {
  get url() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get publishableKey() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  },
};
