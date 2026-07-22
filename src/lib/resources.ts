import type { IconName } from "@/components/ui/icon";

/**
 * Ресурсы и воронки (ТЗ, Блок 3): куда приходит трафик и куда пишут клиенты.
 * Типы совпадают с ограничением resources.type в базе.
 */

export const RESOURCE_TYPES = ["whatsapp", "site", "tilda", "other"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ResourceKind = {
  key: ResourceType;
  title: string;
  summary: string;
  icon: IconName;
  valueLabel: string;
  valuePlaceholder: string;
};

export const RESOURCE_KINDS: Record<ResourceType, ResourceKind> = {
  whatsapp: {
    key: "whatsapp",
    title: "WhatsApp-номера",
    summary: "Куда пишут клиенты из рекламы. По ним же идёт авто-раздача лидов",
    icon: "chat",
    valueLabel: "Номер",
    valuePlaceholder: "+7 701 234 56 78",
  },
  site: {
    key: "site",
    title: "Сайты и лендинги",
    summary: "Страницы, на которые ведёт реклама",
    icon: "link",
    valueLabel: "Адрес",
    valuePlaceholder: "https://school.kz/english",
  },
  tilda: {
    key: "tilda",
    title: "Tilda",
    summary: "Страницы на Tilda: отсюда позже подтянем формы и события",
    icon: "creative",
    valueLabel: "Адрес страницы",
    valuePlaceholder: "https://project.tilda.ws/lp",
  },
  other: {
    key: "other",
    title: "Другое",
    summary: "Всё остальное: чаты, группы, каналы",
    icon: "folder",
    valueLabel: "Ссылка или значение",
    valuePlaceholder: "https://t.me/lidera_channel",
  },
};

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

const PHONE_DIGITS = /\d/g;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;
const MAX_VALUE_LENGTH = 500;

export type NormalizedValue = { ok: true; value: string } | { ok: false; error: string };

/**
 * Приводит значение к единому виду: номер — к «+7…», ссылку — к адресу с протоколом.
 * Один и тот же номер, записанный по-разному, не должен появляться в списке дважды.
 */
export function normalizeResourceValue(type: ResourceType, raw: string): NormalizedValue {
  const value = raw.trim().slice(0, MAX_VALUE_LENGTH);
  if (!value) return { ok: false, error: "Укажите значение ресурса." };

  if (type === "whatsapp") {
    const digits = value.match(PHONE_DIGITS)?.join("") ?? "";
    if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
      return { ok: false, error: "Номер выглядит неправильно — проверьте количество цифр." };
    }
    return { ok: true, value: `+${digits}` };
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) {
      return { ok: false, error: "Адрес выглядит неправильно — проверьте домен." };
    }
    return { ok: true, value: url.toString().replace(/\/$/, "") };
  } catch {
    return { ok: false, error: "Не удалось разобрать адрес. Пример: https://school.kz/english" };
  }
}

/** Ссылка «написать в WhatsApp» из сохранённого номера. */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
