import type { Plan } from "./domain";

/**
 * Тарифы платформы (ТЗ, раздел 3, пункт 5).
 * Поле projects.plan заполняется с самого начала; приём денег подключим позже,
 * поэтому лимиты здесь описательные — они показываются, но ничего не блокируют.
 */

export type PlanCard = {
  key: Plan;
  title: string;
  tagline: string;
  /** Цена словами: реальный прайс появится вместе с оплатой. */
  price: string;
  /** Ограничение по числу сотрудников; null — без ограничения. */
  staffLimit: number | null;
  /** Глубина истории в днях; null — без ограничения. */
  historyDays: number | null;
  features: readonly string[];
};

export const PLAN_CARDS: readonly PlanCard[] = [
  {
    key: "free",
    title: "Free",
    tagline: "Посмотреть платформу и завести первый проект",
    price: "Бесплатно",
    staffLimit: 3,
    historyDays: 30,
    features: [
      "Один проект",
      "До 3 сотрудников",
      "Лиды, продажи, клиенты",
      "История за 30 дней",
    ],
  },
  {
    key: "trial",
    title: "Trial",
    tagline: "Полный доступ на время знакомства",
    price: "14 дней бесплатно",
    staffLimit: null,
    historyDays: null,
    features: [
      "Все разделы платформы",
      "Сотрудники без ограничений",
      "Реклама и интеграции",
      "История без ограничений",
    ],
  },
  {
    key: "pro",
    title: "Pro",
    tagline: "Рабочий тариф агентства",
    price: "По договорённости",
    staffLimit: null,
    historyDays: null,
    features: [
      "Всё из Trial",
      "Сквозная аналитика креативов",
      "CAPI и авто-раздача лидов",
      "Приоритетная поддержка",
    ],
  },
] as const;

export function getPlanCard(plan: Plan): PlanCard {
  return PLAN_CARDS.find((card) => card.key === plan) ?? PLAN_CARDS[0];
}
