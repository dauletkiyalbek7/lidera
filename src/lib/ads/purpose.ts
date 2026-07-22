/**
 * Назначение рекламной кампании.
 *
 * Часть бюджета уходит не на курсы, а на поиск сотрудников. Такие кампании
 * нельзя мешать с продающими: они дают отклики соискателей, а не заявки на
 * обучение, и портят цену лида — вакансия стоит дешевле, и средняя цена
 * получается обманчиво низкой.
 *
 * Отличаем по названию кампании: другого признака у Meta нет — цель у обоих
 * типов чаще всего одна и та же (заявки или переписки).
 */

export const CAMPAIGN_PURPOSES = ["courses", "vacancy"] as const;
export type CampaignPurpose = (typeof CAMPAIGN_PURPOSES)[number];

export const PURPOSE_LABELS: Record<CampaignPurpose, string> = {
  courses: "Курсы",
  vacancy: "Вакансии",
};

/**
 * Слова, по которым кампания считается наймом.
 * Кириллица и латиница вперемешку: в кабинете названия пишут и так, и так.
 */
const VACANCY_WORDS = [
  "vac",
  "вакансия",
  "вакансии",
  "вакансий",
  "вакансию",
  "вак",
  "vakansia",
  "vakansiya",
  "vacancy",
  "hr",
  "найм",
];

/** Разделители слов: пробелы, дефисы, точки, подчёркивания, скобки. */
const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

/**
 * Схлопывает повторы букв: «vaaaac» → «vac», «вааакансия» → «вакансия».
 * Названия в кабинете тянут гласные («bota vaaaac — Копия»), и без этого
 * такая кампания уезжает в курсы и портит цену лида.
 */
function collapseRuns(value: string): string {
  return value.replace(/(.)\1+/gu, "$1");
}

/**
 * «вак» ищем как отдельное слово, а не как кусок другого: иначе «вакцина»
 * или «Wakeboard» превратятся в вакансию. Длинные слова ищем и внутри —
 * их случайно не встретишь.
 */
export function campaignPurpose(name: string | null | undefined): CampaignPurpose {
  if (!name) return "courses";

  const lowered = name.toLowerCase();
  const collapsed = collapseRuns(lowered);
  const words = lowered.split(WORD_SPLIT).filter(Boolean);
  const collapsedWords = words.map(collapseRuns);

  for (const word of VACANCY_WORDS) {
    if (word.length <= 3) {
      if (words.includes(word) || collapsedWords.includes(word)) return "vacancy";
    } else if (lowered.includes(word) || collapsed.includes(word)) {
      return "vacancy";
    }
  }

  return "courses";
}

export function isVacancyCampaign(name: string | null | undefined): boolean {
  return campaignPurpose(name) === "vacancy";
}
