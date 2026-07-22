import type { IconName } from "@/components/ui/icon";
import type { GlobalRole, Niche } from "./domain";

/**
 * Карта блоков и разделов платформы (ТЗ, раздел 7).
 * Один источник правды: боковое меню, заглушки и настройки разделов читают отсюда.
 */

/** Готовность раздела — метки приоритета из ТЗ. */
export type SectionStage = "ready" | "basic" | "later" | "postponed";

export const STAGE_BADGES: Record<SectionStage, string | null> = {
  ready: null,
  basic: null,
  later: "Скоро",
  postponed: "Отложено",
};

export type Section = {
  /** Ключ раздела: он же section_key в project_sections и access_rights. */
  key: string;
  title: string;
  /** Что раздел делает — показываем на заглушке. */
  summary: string;
  icon: IconName;
  stage: SectionStage;
  /** Путь внутри кабинета проекта; пусто у Главной. */
  path: string;
  /** Ниши, где раздел показывается. */
  niches: readonly Niche[];
  /** Роли, которым раздел виден. Пусто = всем ролям проекта. */
  roles?: readonly GlobalRole[];
  /** Пункты, которые заглушка перечисляет как будущее содержимое. */
  plan?: readonly string[];
};

export type NavBlock = {
  key: string;
  title: string;
  sections: readonly Section[];
};

const ALL_NICHES = ["education", "ecommerce"] as const;

/** Разделы, которые нельзя выключить тумблером: без них в проект не вернуться. */
export const LOCKED_SECTION_KEYS = [
  "dashboard",
  "settings-sections",
  "settings-employees",
  "access-rights",
] as const;

export const NAV_BLOCKS: readonly NavBlock[] = [
  {
    key: "overview",
    title: "Обзор",
    sections: [
      {
        key: "dashboard",
        title: "Главная",
        summary: "Сводка метрик проекта за выбранный период",
        icon: "home",
        stage: "ready",
        path: "",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
      },
      {
        key: "my-report",
        title: "Мой отчёт",
        summary: "Личная ежедневная отчётность сотрудника (РМП)",
        icon: "report",
        stage: "ready",
        path: "my-report",
        niches: ALL_NICHES,
        plan: [
          "Форма ежедневного отчёта сотрудника",
          "История своих записей по датам",
          "Сотрудник видит только свои отчёты",
        ],
      },
    ],
  },
  {
    key: "sales",
    title: "Продажи и CRM",
    sections: [
      {
        key: "leads",
        title: "Лиды",
        summary: "Входящие лиды: источник, статус, ответственный",
        icon: "leads",
        stage: "ready",
        path: "leads",
        niches: ALL_NICHES,
        plan: [
          "Таблица лидов с фильтром по периоду и источнику",
          "Счётчики: пришло, обработано, записалось на пробный, купили",
          "Назначение ответственного менеджера",
        ],
      },
      {
        key: "crm-funnel",
        title: "CRM-воронка",
        summary: "Визуальная воронка по этапам, канбан и счётчики",
        icon: "funnel",
        stage: "ready",
        path: "crm-funnel",
        niches: ALL_NICHES,
        plan: [
          "Канбан по этапам воронки ниши",
          "Перетаскивание карточек между этапами",
          "Счётчики и конверсия между этапами",
        ],
      },
      {
        key: "trial-lessons",
        title: "Пробные уроки",
        summary: "Записи на пробный: записан → проведён → купил",
        icon: "trial",
        stage: "ready",
        path: "trial-lessons",
        niches: ["education"],
        plan: [
          "Список записей с датой и продажником",
          "Статусы: записан, проведён, купил курс",
          "Показатель доходимости до пробного",
        ],
      },
      {
        key: "sales",
        title: "Продажи",
        summary: "Список продаж и деньги по периоду",
        icon: "sales",
        stage: "ready",
        path: "sales",
        niches: ALL_NICHES,
        plan: [
          "Карточки: доход, расходы, чистая прибыль, средний чек, конверсия",
          "Список продаж с продуктом и продажником",
        ],
      },
      {
        key: "returns",
        title: "Возвраты",
        summary: "Оформление возврата: РОП или директор",
        icon: "returns",
        stage: "ready",
        path: "returns",
        niches: ALL_NICHES,
        roles: ["owner", "director", "rop"],
        plan: [
          "Оформление возврата по продаже",
          "Причина и сумма, история сохраняется",
          "Пересчёт метрик периода",
        ],
      },
      {
        key: "customers",
        title: "Клиенты",
        summary: "Купившие: покупки, суммы, общий LTV",
        icon: "customers",
        stage: "ready",
        path: "customers",
        niches: ALL_NICHES,
        plan: [
          "Список клиентов с телефоном и датой первой покупки",
          "Что купили и на какую сумму",
          "Общая сумма покупок клиента (LTV)",
        ],
      },
      {
        key: "products",
        title: "Товары (склад)",
        summary: "Каталог и остатки на складе",
        icon: "office",
        stage: "ready",
        path: "products",
        niches: ["ecommerce"],
        plan: [
          "Каталог товаров: SKU, себестоимость, цена продажи",
          "Остатки и порог «заканчивается»",
          "Себестоимость склада",
        ],
      },
      {
        key: "call-analysis",
        title: "Анализ звонков",
        summary: "AI-оценка звонков менеджеров и продажников",
        icon: "calls",
        stage: "later",
        path: "call-analysis",
        niches: ALL_NICHES,
        plan: [
          "Загрузка записей звонков",
          "Оценка: приветствие, структура, длительность",
          "Итоговый балл и динамика по сотруднику",
        ],
      },
      {
        key: "manager-office",
        title: "Кабинет менеджера",
        summary: "Лиды менеджера, записанные пробные, показатели",
        icon: "office",
        stage: "ready",
        path: "manager-office",
        niches: ["education"],
        plan: [
          "Свои лиды и их статусы",
          "Записанные пробные уроки",
          "Личные показатели за период",
        ],
      },
      {
        key: "salesperson-office",
        title: "Кабинет продажника",
        summary: "Проведённые пробные, закрытые продажи, показатели",
        icon: "office",
        stage: "ready",
        path: "salesperson-office",
        niches: ["education"],
        plan: [
          "Проведённые пробные уроки",
          "Закрытые продажи курса",
          "Личная конверсия и средний чек",
        ],
      },
    ],
  },
  {
    key: "marketing",
    title: "Маркетинг",
    sections: [
      {
        key: "ads",
        title: "Реклама",
        summary: "Кампании Meta Ads: бюджеты, расход и лиды",
        icon: "ads",
        stage: "ready",
        path: "ads",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Подключение рекламных кабинетов Meta и TikTok",
          "Кампании: бюджеты, креативы, суммы, город, метрики",
          "Позже — запуск кампаний AI-агентом",
        ],
      },
      {
        key: "creatives-analytics",
        title: "Аналитика креативов",
        summary: "Сквозная связка креатив → лид → продажа",
        icon: "creative",
        stage: "ready",
        path: "creatives-analytics",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Эффективность креатива: CPL, конверсия, ROAS",
          "Доля качественных лидов по креативу",
          "Сравнение Meta и TikTok",
        ],
      },
      {
        key: "marketing-dashboard",
        title: "Marketing Dashboard",
        summary: "Деньги, лиды, продажи и сохранённые воронки",
        icon: "chart",
        stage: "ready",
        path: "marketing-dashboard",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Сводные метрики маркетинга за период",
          "Сохранённые рабочие воронки",
        ],
      },
      {
        key: "smm-studio",
        title: "SMM Studio",
        summary: "AI-генерация идей контента под инфоповод",
        icon: "sparkle",
        stage: "later",
        path: "smm-studio",
        niches: ALL_NICHES,
        plan: ["Идеи постов, stories и каруселей", "Генерация под инфоповод"],
      },
      {
        key: "capi",
        title: "CAPI",
        summary: "Отправка событий покупки в рекламные кабинеты",
        icon: "send",
        stage: "later",
        path: "capi",
        niches: ALL_NICHES,
        plan: [
          "Meta Ads — события через сайт",
          "TikTok Ads — события через сайт (instant page)",
          "WhatsApp — вместо CAPI авто-раздача лидов",
          "Поток: чек → Telegram-бот → подтверждение → событие в кабинет",
        ],
      },
      {
        key: "resources",
        title: "Ресурсы и воронки",
        summary: "WhatsApp-номера, сайты и лендинги, Tilda",
        icon: "link",
        stage: "ready",
        path: "resources",
        niches: ALL_NICHES,
        roles: ["owner", "director", "rop"],
        plan: [
          "Наши WhatsApp-номера",
          "Сайты и лендинги проекта",
          "Подключение Tilda",
        ],
      },
      {
        key: "ai-studio",
        title: "AI Studio",
        summary: "Генерация креативов: видео и баннеры",
        icon: "sparkle",
        stage: "later",
        path: "ai-studio",
        niches: ALL_NICHES,
        plan: ["Генерация видео-креативов", "Генерация баннеров"],
      },
    ],
  },
  {
    key: "automation",
    title: "Автоматизация",
    sections: [
      {
        key: "chatbot",
        title: "Чат-бот",
        summary: "ChatPlace: входящие сообщения превращаются в лиды",
        icon: "chat",
        stage: "ready",
        path: "chatbot",
        niches: ALL_NICHES,
        roles: ["owner", "director", "rop", "manager"],
        plan: [
          "Подключение ChatPlace",
          "Оставленный номер → лид в разделе «Лиды»",
          "Источник лида проставляется автоматически",
        ],
      },
      {
        key: "integrations",
        title: "Интеграции",
        summary: "Что подключено и что нет: ключи, боты, сервисы",
        icon: "plug",
        stage: "ready",
        path: "integrations",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Статусы подключения по провайдерам",
          "Ключи хранятся только на сервере, зашифрованно",
        ],
      },
    ],
  },
  {
    key: "finance",
    title: "Финансы и HR",
    sections: [
      {
        key: "finance",
        title: "Финансы",
        summary: "Раздел отложен до отдельного решения",
        icon: "wallet",
        stage: "postponed",
        path: "finance",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
      },
      {
        key: "salaries",
        title: "Зарплаты",
        summary: "Оклад, процент от продаж и бонусы за результат",
        icon: "money",
        stage: "ready",
        path: "salaries",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Правила начисления на роль и лично",
          "Расчёт из продаж, лидов и табеля",
          "Фонд оплаты за выбранный период",
        ],
      },
      {
        key: "attendance",
        title: "Посещаемость",
        summary: "Табель отдела по дням периода",
        icon: "calendar",
        stage: "ready",
        path: "attendance",
        niches: ALL_NICHES,
        roles: ["owner", "director", "rop"],
        plan: ["Отметки по дням", "Прогулы, опоздания, больничные", "Связь с расчётом зарплаты"],
      },
      {
        key: "work-schedule",
        title: "График работы",
        summary: "Повторяющаяся неделя: смены сотрудников",
        icon: "clock",
        stage: "ready",
        path: "work-schedule",
        niches: ALL_NICHES,
        roles: ["owner", "director", "rop"],
        plan: ["Смены по дням недели", "Часы на человека и на отдел"],
      },
      {
        key: "contracts",
        title: "Договоры",
        summary: "Карточки договоров: реквизиты, сроки, сумма",
        icon: "contract",
        stage: "ready",
        path: "contracts",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: ["Договоры с сотрудниками и клиентами", "Сроки и напоминание об истечении"],
      },
    ],
  },
  {
    key: "system",
    title: "Система",
    sections: [
      {
        key: "reports",
        title: "Отчёты",
        summary: "Все отчёты сотрудников проекта",
        icon: "folder",
        stage: "ready",
        path: "reports",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Список отчётов всех сотрудников",
          "Фильтр по сотруднику и периоду",
        ],
      },
      {
        key: "settings-sections",
        title: "Разделы проекта",
        summary: "Тумблеры: какие разделы включены на проекте",
        icon: "sliders",
        stage: "ready",
        path: "settings/sections",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: ["Включение и выключение разделов проекта"],
      },
      {
        key: "settings-employees",
        title: "Сотрудники",
        summary: "Приём, роли и увольнение сотрудников",
        icon: "people",
        stage: "ready",
        path: "settings/employees",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Добавление сотрудника с генерацией логина и пароля",
          "Роль и дата приёма",
          "Увольнение: статус fired, данные сохраняются",
        ],
      },
      {
        key: "settings-telegram",
        title: "Telegram-бот",
        summary: "Подключение сотрудников к боту платформы",
        icon: "send",
        stage: "ready",
        path: "settings/telegram",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
      },
      {
        key: "plan",
        title: "Тариф",
        summary: "Что входит в тариф и на каком сейчас проект",
        icon: "wallet",
        stage: "ready",
        path: "settings/plan",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: ["Free, Trial и Pro", "Текущий тариф проекта", "Оплата — позже"],
      },
      {
        key: "access-rights",
        title: "Права доступа",
        summary: "Таблица «разделы × роли»: кто что видит и может",
        icon: "shield",
        stage: "ready",
        path: "settings/access",
        niches: ALL_NICHES,
        roles: ["owner", "director"],
        plan: [
          "Матрица разделов и ролей",
          "Просмотр и редактирование по разделу",
          "Число доступных разделов на роль",
        ],
      },
    ],
  },
] as const;

const SECTIONS_BY_KEY = new Map<string, Section>(
  NAV_BLOCKS.flatMap((block) => block.sections).map((section) => [section.key, section]),
);

const SECTIONS_BY_PATH = new Map<string, Section>(
  NAV_BLOCKS.flatMap((block) => block.sections).map((section) => [section.path, section]),
);

const BLOCK_TITLE_BY_SECTION = new Map<string, string>(
  NAV_BLOCKS.flatMap((block) => block.sections.map((section) => [section.key, block.title])),
);

/** Название блока меню, в котором лежит раздел — показываем надзаголовком страницы. */
export function sectionBlockTitle(key: string): string | undefined {
  return BLOCK_TITLE_BY_SECTION.get(key);
}

export function getSectionByKey(key: string): Section | undefined {
  return SECTIONS_BY_KEY.get(key);
}

export function getSectionByPath(path: string): Section | undefined {
  return SECTIONS_BY_PATH.get(path);
}

export function isSectionVisible(
  section: Section,
  niche: Niche,
  role: GlobalRole,
): boolean {
  if (!section.niches.includes(niche)) return false;
  if (section.roles && !section.roles.includes(role)) return false;
  return true;
}

/** Меню под нишу и роль, с учётом выключенных на проекте разделов. */
export function buildNavigation(
  niche: Niche,
  role: GlobalRole,
  disabledSectionKeys: ReadonlySet<string> = new Set(),
): NavBlock[] {
  return NAV_BLOCKS.map((block) => ({
    key: block.key,
    title: block.title,
    sections: block.sections.filter(
      (section) =>
        isSectionVisible(section, niche, role) && !disabledSectionKeys.has(section.key),
    ),
  })).filter((block) => block.sections.length > 0);
}

export function sectionHref(projectId: string, section: Section): string {
  return section.path ? `/p/${projectId}/${section.path}` : `/p/${projectId}`;
}
