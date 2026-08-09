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
  /** Ещё одно несекретное поле config (у Meta — Pixel ID для CAPI). */
  extraLabel?: string;
  extraPlaceholder?: string;
  /** Ключ этого поля в config и в форме. */
  extraKey?: string;
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
    extraLabel: "Pixel ID (dataset) — для CAPI",
    extraPlaceholder: "1234567890",
    extraKey: "pixel_id",
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
    key: "amocrm",
    title: "amoCRM",
    summary: "CRM клиента: сделки, контакты и звонки подтягиваются в платформу",
    icon: "office",
    secretLabel: "Долгосрочный токен доступа",
    secretPlaceholder: "eyJ0eXAiOiJKV1QiLCJhbGciOi…",
    accountLabel: "Адрес аккаунта",
    accountPlaceholder: "mycompany.amocrm.ru",
    where: "amoCRM → Настройки → Интеграции → создать интеграцию → «Ключи и доступы» → долгосрочный токен",
    powers: ["Лиды", "CRM-воронка", "Анализ звонков"],
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
    key: "openai",
    title: "OpenAI",
    summary: "Транскрипция звонков (Whisper) и оценка качества разговоров",
    icon: "sparkle",
    secretLabel: "API-ключ",
    secretPlaceholder: "sk-…",
    where: "platform.openai.com → API keys (нужен пополненный баланс)",
    powers: ["Анализ звонков", "AI Studio", "SMM Studio"],
  },
  {
    key: "deepseek",
    title: "DeepSeek",
    summary: "Дешёвая оценка звонков и генерация текста",
    icon: "sparkle",
    secretLabel: "API-ключ",
    secretPlaceholder: "sk-…",
    where: "platform.deepseek.com → API keys (нужен пополненный баланс)",
    powers: ["Анализ звонков", "SMM Studio"],
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
