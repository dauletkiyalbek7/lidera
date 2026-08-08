/**
 * Инициалы для аватара: одна-две первые буквы имени.
 * Общий помощник — используют канбан, таблицы лидов/клиентов и чип пользователя,
 * чтобы кружок с буквами везде считался одинаково.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
