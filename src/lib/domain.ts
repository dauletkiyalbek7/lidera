/**
 * Словарь предметной области (ТЗ, разделы 4 и 6).
 * Терминология ролей уточнена: менеджер записывает на пробные, продажник их проводит и продаёт курс.
 */

export const NICHES = ["education", "ecommerce"] as const;
export type Niche = (typeof NICHES)[number];

export const NICHE_LABELS: Record<Niche, string> = {
  education: "Образование",
  ecommerce: "Товарка / e-commerce",
};

export const NICHE_HINTS: Record<Niche, string> = {
  education: "Воронка: лид → пробный урок → продажа курса",
  ecommerce: "Воронка: лид → обработан → продажа",
};

export const GLOBAL_ROLES = [
  "owner",
  "director",
  "rop",
  "manager",
  "salesperson",
] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

/** Роли внутри проекта — те же, кроме владельца платформы. */
export const PROJECT_ROLES = ["director", "rop", "manager", "salesperson"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const ROLE_LABELS: Record<GlobalRole, string> = {
  owner: "Владелец",
  director: "Директор",
  rop: "РОП",
  manager: "Менеджер",
  salesperson: "Продажник",
};

export const ROLE_DUTIES: Record<GlobalRole, string> = {
  owner: "Все проекты; создаёт и удаляет проекты",
  director: "Видит весь свой проект, включая Главную и Отчёты",
  rop: "Оформляет возвраты, следит за отделом продаж",
  manager: "Квалифицирует лиды, записывает и продаёт пробные уроки",
  salesperson: "Проводит пробные уроки, закрывает продажу курса",
};

export const PROJECT_STATUSES = ["active", "paused", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Активен",
  paused: "На паузе",
  completed: "Завершён",
};

export const PLANS = ["free", "trial", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  trial: "Trial",
  pro: "Pro",
};

/** Этапы воронки по нишам (ТЗ, раздел 6). */
export const FUNNEL_STAGES: Record<Niche, { key: string; label: string }[]> = {
  education: [
    { key: "leads", label: "Лиды" },
    { key: "qualified", label: "Квалифицированы" },
    { key: "trial_lessons", label: "Пробные уроки" },
    { key: "sales", label: "Продажи курса" },
  ],
  ecommerce: [
    { key: "leads", label: "Лиды" },
    { key: "qualified", label: "Обработаны" },
    { key: "sales", label: "Продажи" },
  ],
};

/** Этапы лида по нишам: порядок важен — по нему строятся канбан и воронка. */
export const LEAD_STATUS_FLOW: Record<Niche, readonly string[]> = {
  education: ["new", "qualified", "trial_booked", "trial_done", "sale"],
  ecommerce: ["new", "processed", "sale"],
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  qualified: "Квалифицирован",
  processed: "Обработан",
  trial_booked: "Записан на пробный",
  trial_done: "Пробный проведён",
  sale: "Купил",
};

/** Статусы пробного урока — подмножество этапов лида (ТЗ, раздел 7). */
export const TRIAL_STATUS_FLOW = ["trial_booked", "trial_done", "sale"] as const;

export const TRIAL_STATUS_LABELS: Record<string, string> = {
  trial_booked: "Записан",
  trial_done: "Проведён",
  sale: "Купил курс",
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  other: "Другое",
};

export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? status;
}

export function leadSourceLabel(source: string | null): string {
  if (!source) return "Не указан";
  return LEAD_SOURCE_LABELS[source] ?? source;
}

export function isNiche(value: string): value is Niche {
  return (NICHES as readonly string[]).includes(value);
}

export function isProjectRole(value: string): value is ProjectRole {
  return (PROJECT_ROLES as readonly string[]).includes(value);
}

export function asProjectStatus(value: string): ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value)
    ? (value as ProjectStatus)
    : "active";
}

export function asPlan(value: string): Plan {
  return (PLANS as readonly string[]).includes(value) ? (value as Plan) : "trial";
}

export function asNiche(value: string): Niche {
  return isNiche(value) ? value : "education";
}

export function asGlobalRole(value: string): GlobalRole {
  return (GLOBAL_ROLES as readonly string[]).includes(value)
    ? (value as GlobalRole)
    : "director";
}
