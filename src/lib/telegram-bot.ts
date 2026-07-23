import { ROLE_LABELS, type ProjectRole } from "@/lib/domain";
import { formatMoney, formatNumber } from "@/lib/format";
import type { BotMetrics } from "@/lib/queries/telegram-bot";

/**
 * Тексты и меню Telegram-бота (ТЗ, раздел 7).
 *
 * Отделено от вебхука, чтобы формулировки можно было проверить без сети:
 * на вход — данные, на выход — строка и клавиатура. Разметку не используем
 * (parse_mode не задаём): проще и не ломается на именах с символами.
 */

/** Данные кнопок меню — их же присылает Telegram в callback_query. */
export const BOT_ACTIONS = {
  metrics: "metrics",
  report: "report",
  shiftOn: "shift_on",
  shiftOff: "shift_off",
} as const;

export type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

/** Смену показываем только тем, кому раздают лиды, — менеджерам. */
function takesLeads(role: ProjectRole): boolean {
  return role === "manager";
}

export function botMenu(role: ProjectRole, onShift: boolean): InlineKeyboard {
  const rows: { text: string; callback_data: string }[][] = [
    [{ text: "📊 Мои показатели", callback_data: BOT_ACTIONS.metrics }],
    [{ text: "📝 Отчёт за день", callback_data: BOT_ACTIONS.report }],
  ];
  if (takesLeads(role)) {
    rows.unshift([
      onShift
        ? { text: "🔴 Уйти со смены", callback_data: BOT_ACTIONS.shiftOff }
        : { text: "🟢 Встать на смену", callback_data: BOT_ACTIONS.shiftOn },
    ]);
  }
  return { inline_keyboard: rows };
}

export function renderWelcome(
  fullName: string,
  role: ProjectRole,
  onShift: boolean,
  justLinked: boolean,
): string {
  const head = justLinked
    ? `Готово, ${fullName}! Чат привязан к вашей учётке в Lidera.`
    : `С возвращением, ${fullName}.`;
  const shift = takesLeads(role)
    ? `\nСмена: ${onShift ? "🟢 на смене — лиды приходят вам" : "🔴 не на смене — лиды не приходят"}`
    : "";
  return `${head}\nРоль: ${ROLE_LABELS[role]}.${shift}\n\nВыберите, что показать:`;
}

export function renderShiftChanged(onShift: boolean): string {
  return onShift
    ? "🟢 Вы на смене. Новые лиды теперь приходят вам по кругу."
    : "🔴 Вы ушли со смены. Новые лиды вам приходить не будут.";
}

function line(label: string, today: number, month: number): string {
  return `• ${label}: ${formatNumber(today)} за сегодня · ${formatNumber(month)} за месяц`;
}

function moneyLine(label: string, today: number, month: number, currency: string): string {
  return `• ${label}: ${formatMoney(today, currency)} · ${formatMoney(month, currency)} за месяц`;
}

/** Строки показателей подбираем по роли: каждому — то, за что он отвечает. */
export function renderMetrics(metrics: BotMetrics, currency: string): string {
  const { role, today, month } = metrics;
  const lines: string[] = [];

  if (role === "manager") {
    lines.push(
      line("Лиды на мне", today.leads, month.leads),
      line("Квалифицировано", today.qualified, month.qualified),
      line("Записано на пробный", today.trials, month.trials),
    );
  } else if (role === "salesperson") {
    lines.push(
      line("Продажи", today.sales, month.sales),
      moneyLine("Выручка", today.revenue, month.revenue, currency),
    );
    if (month.sales > 0) {
      lines.push(`• Средний чек за месяц: ${formatMoney(month.revenue / month.sales, currency)}`);
    }
  } else {
    // РОП, директор, владелец — сводка по проекту.
    lines.push(
      line("Лиды проекта", today.leads, month.leads),
      line("Продажи", today.sales, month.sales),
      moneyLine("Выручка", today.revenue, month.revenue, currency),
    );
  }

  const scope = metrics.personal ? "Ваши показатели" : "Показатели проекта";
  return `${scope}\n\n${lines.join("\n")}`;
}

export function renderReportStub(): string {
  return (
    "Заполнение отчёта из бота скоро подключим. " +
    "Пока отправьте отчёт на сайте в разделе «Мой отчёт»."
  );
}

export function renderNotLinked(): string {
  return (
    "Чтобы подключиться, откройте личную ссылку-приглашение от руководителя " +
    "или пришлите код привязки одним сообщением."
  );
}
