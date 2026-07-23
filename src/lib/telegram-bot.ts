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
} as const;

export type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

export function botMenu(): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "📊 Мои показатели", callback_data: BOT_ACTIONS.metrics }],
      [{ text: "📝 Отчёт за день", callback_data: BOT_ACTIONS.report }],
    ],
  };
}

export function renderWelcome(fullName: string, role: ProjectRole, justLinked: boolean): string {
  const head = justLinked
    ? `Готово, ${fullName}! Чат привязан к вашей учётке в Lidera.`
    : `С возвращением, ${fullName}.`;
  return `${head}\nРоль: ${ROLE_LABELS[role]}.\n\nВыберите, что показать:`;
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
