/**
 * Правила оценки звонков проекта (ТЗ, Блок 2).
 * Отдел продаж задаёт свои критерии и скрипт; AI оценивает запись по ним.
 * Один источник правды для формы, движка оценки и отображения разбора.
 */

export type RubricCriterion = {
  /** Стабильный ключ критерия — по нему храним балл в calls.breakdown. */
  key: string;
  label: string;
  weight: number;
};

/** Язык звонков: подсказка для транскрипции. Авто — определять самому. */
export type CallLanguage = "auto" | "kk" | "ru";

export const CALL_LANGUAGES: { value: CallLanguage; label: string }[] = [
  { value: "kk", label: "Казахский" },
  { value: "ru", label: "Русский" },
  { value: "auto", label: "Авто (смешанный)" },
];

export type CallRubric = {
  script: string;
  criteria: RubricCriterion[];
  /** На каком языке говорят менеджеры — по умолчанию казахский. */
  language: CallLanguage;
};

/** Стартовая рубрика: работает из коробки, проект правит под себя. */
export const DEFAULT_RUBRIC: CallRubric = {
  script: "",
  language: "kk",
  criteria: [
    { key: "greeting", label: "Приветствие и установление контакта", weight: 15 },
    { key: "needs", label: "Выявление потребности", weight: 25 },
    { key: "presentation", label: "Презентация по скрипту", weight: 20 },
    { key: "objections", label: "Отработка возражений", weight: 20 },
    { key: "closing", label: "Договорённость о следующем шаге", weight: 20 },
  ],
};

function asLanguage(raw: unknown): CallLanguage {
  return raw === "kk" || raw === "ru" || raw === "auto" ? raw : "kk";
}

export const MAX_CRITERIA = 12;
const MAX_LABEL = 120;
const MAX_SCRIPT = 6000;

/**
 * Верхняя граница шкалы. Есть критерии — сумма их весов; нет (правила заданы
 * одним текстом) — 100, оценка целостная.
 */
export function rubricMaxScore(rubric: CallRubric): number {
  if (rubric.criteria.length === 0) return 100;
  return rubric.criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
}

/** Пустая рубрика — нечего оценивать (ни критериев, ни текста правил). */
export function rubricIsEmpty(rubric: CallRubric): boolean {
  return rubric.criteria.length === 0 && !rubric.script.trim();
}

/**
 * Приводит произвольный jsonb из базы к валидной рубрике.
 * Пустое/битое → дефолт, чтобы движок и форма всегда получали рабочую структуру.
 */
export function normalizeRubric(raw: unknown): CallRubric {
  if (!raw || typeof raw !== "object") return DEFAULT_RUBRIC;
  const obj = raw as { script?: unknown; criteria?: unknown };
  const criteria = Array.isArray(obj.criteria)
    ? obj.criteria
        .map((item, index) => {
          const c = item as { key?: unknown; label?: unknown; weight?: unknown };
          const label = typeof c.label === "string" ? c.label.trim().slice(0, MAX_LABEL) : "";
          const weight = Math.max(0, Math.round(Number(c.weight)) || 0);
          const key = typeof c.key === "string" && c.key.trim() ? c.key.trim() : `c${index}`;
          return { key, label, weight };
        })
        .filter((c) => c.label && c.weight > 0)
        .slice(0, MAX_CRITERIA)
    : [];

  const language = asLanguage((raw as { language?: unknown }).language);
  const script = typeof obj.script === "string" ? obj.script.slice(0, MAX_SCRIPT) : "";

  // Нет критериев и нет текста правил — отдаём дефолтную рубрику. Но если правила
  // заданы одним текстом (без критериев) — это валидный текстовый режим, храним как есть.
  if (criteria.length === 0 && !script.trim()) return { ...DEFAULT_RUBRIC, language };

  return { script, criteria, language };
}

/** Собирает рубрику из формы (пары criteria_label[]/criteria_weight[]). */
export function rubricFromForm(
  labels: string[],
  weights: string[],
  script: string,
  language: string,
): CallRubric {
  const criteria: RubricCriterion[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = (labels[i] ?? "").trim().slice(0, MAX_LABEL);
    const weight = Math.max(0, Math.round(Number(weights[i])) || 0);
    if (label && weight > 0) criteria.push({ key: `c${criteria.length}`, label, weight });
  }
  return {
    script: script.slice(0, MAX_SCRIPT),
    criteria: criteria.slice(0, MAX_CRITERIA),
    language: asLanguage(language),
  };
}
