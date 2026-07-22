import type { IconName } from "@/components/ui/icon";

/**
 * Каталог интеграций (ТЗ, Блок 4).
 * Один источник правды: экран подключений, действия и проверки читают отсюда.
 */

export type IntegrationProvider = {
  key: string;
  title: string;
  summary: string;
  icon: IconName;
  /** Как называется секрет у этого провайдера — подпись поля ввода. */
  secretLabel: string;
  secretPlaceholder: string;
  /** Необязательный несекретный идентификатор кабинета: его показываем открыто. */
  accountLabel?: string;
  accountPlaceholder?: string;
  /** Где взять ключ — подсказка человеку, который подключает. */
  where: string;
  /** Разделы платформы, которые оживут после подключения. */
  powers: readonly string[];
};

export const INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = [
  {
    key: "meta",
    title: "Meta Ads",
    summary: "Кампании Facebook и Instagram: бюджеты, креативы, расход и метрики",
    icon: "ads",
    secretLabel: "Access token",
    secretPlaceholder: "EAAG…",
    accountLabel: "ID рекламного кабинета",
    accountPlaceholder: "act_1234567890",
    where: "Meta Business → Настройки → Токены доступа",
    powers: ["Реклама", "Аналитика креативов", "CAPI"],
  },
  {
    key: "tiktok",
    title: "TikTok Ads",
    summary: "Кампании TikTok: бюджеты, креативы, расход и метрики",
    icon: "ads",
    secretLabel: "Access token",
    secretPlaceholder: "act.example…",
    accountLabel: "ID рекламодателя",
    accountPlaceholder: "6912345678901234567",
    where: "TikTok Ads Manager → Инструменты → Доступ к API",
    powers: ["Реклама", "Аналитика креативов", "CAPI"],
  },
  {
    key: "chatplace",
    title: "ChatPlace",
    summary: "Входящие сообщения чат-бота: оставленный номер сразу становится лидом",
    icon: "chat",
    secretLabel: "API-ключ",
    secretPlaceholder: "cp_live_…",
    where: "Кабинет ChatPlace → Настройки → API",
    powers: ["Чат-бот", "Лиды"],
  },
  {
    key: "telegram",
    title: "Telegram-бот",
    summary: "Бот платформы: подтверждение продаж по чеку и уведомления сотрудникам",
    icon: "send",
    secretLabel: "Токен бота",
    secretPlaceholder: "1234567890:AA…",
    accountLabel: "Имя бота",
    accountPlaceholder: "@lidera_project_bot",
    where: "Телеграм → @BotFather → /newbot",
    powers: ["Telegram-бот", "CAPI"],
  },
  {
    key: "ai",
    title: "AI-сервис",
    summary: "Генерация креативов, идей контента и разбор звонков",
    icon: "sparkle",
    secretLabel: "API-ключ",
    secretPlaceholder: "sk-…",
    where: "Личный кабинет выбранного AI-провайдера",
    powers: ["AI Studio", "SMM Studio", "Анализ звонков"],
  },
] as const;

const PROVIDERS_BY_KEY = new Map(INTEGRATION_PROVIDERS.map((item) => [item.key, item]));

export function getIntegrationProvider(key: string): IntegrationProvider | undefined {
  return PROVIDERS_BY_KEY.get(key);
}

export const INTEGRATION_STATUSES = ["connected", "disconnected"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  connected: "Подключено",
  disconnected: "Не подключено",
};
