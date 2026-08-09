import "server-only";

import type { AiKeys } from "@/lib/ai/keys";
import { rubricMaxScore, type CallLanguage, type CallRubric } from "@/lib/call-rubric";

/**
 * AI-оценка звонка (ТЗ, Блок 2: «Анализ звонков»).
 * Два шага: транскрипция (OpenAI Whisper — только у OpenAI есть речь-в-текст)
 * и оценка разговора ПО ПРАВИЛАМ ПРОЕКТА (критерии + скрипт задаёт отдел продаж).
 * Оценивает DeepSeek, если есть ключ (дешевле), иначе OpenAI. Возвращает балл,
 * разбивку по критериям, короткие обоснования и резюме на русском.
 */

export class AiError extends Error {}

const TRANSCRIBE_TIMEOUT_MS = 55_000;
const SCORE_TIMEOUT_MS = 40_000;

export type CallScore = {
  transcript: string;
  score: number;
  maxScore: number;
  /** Балл по каждому критерию: ключ критерия → число. */
  breakdown: Record<string, number>;
  /** Короткое обоснование по критерию: ключ → фраза. */
  notes: Record<string, string>;
  summary: string;
};

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Скачиваем запись и отдаём в Whisper. Возвращаем текст разговора. */
async function transcribe(
  recordingUrl: string,
  openaiKey: string,
  language: CallLanguage,
): Promise<string> {
  const audio = await withTimeout(TRANSCRIBE_TIMEOUT_MS, (signal) =>
    fetch(recordingUrl, { signal, cache: "no-store" }),
  ).catch(() => null);
  if (!audio || !audio.ok) throw new AiError("Не удалось скачать запись звонка по ссылке.");

  const blob = await audio.blob();
  const form = new FormData();
  form.append("file", blob, "call.mp3");
  form.append("model", "whisper-1");
  // Подсказка языка резко повышает качество распознавания. Для «авто» не задаём —
  // Whisper определит сам (полезно при смешении казахского и русского).
  if (language !== "auto") form.append("language", language);
  form.append("temperature", "0");

  const res = await withTimeout(TRANSCRIBE_TIMEOUT_MS, (signal) =>
    fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
      signal,
    }),
  ).catch(() => null);

  if (!res) throw new AiError("OpenAI не ответила при транскрипции (таймаут).");
  if (!res.ok) throw new AiError(`OpenAI транскрипция: ошибка ${res.status}.`);
  const json = (await res.json().catch(() => ({}))) as { text?: string };
  return (json.text ?? "").trim();
}

function clampInt(value: unknown, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/** Системный промпт из правил проекта: критерии с максимумами + скрипт. */
function buildSystemPrompt(rubric: CallRubric): string {
  const criteria = rubric.criteria
    .map((c) => `- ключ "${c.key}" (${c.label}) — максимум ${c.weight} баллов`)
    .join("\n");
  const script = rubric.script.trim()
    ? `\n\nСкрипт и правила, которые менеджер обязан соблюдать (сверяй разговор с ними):\n${rubric.script.trim()}`
    : "";
  return (
    "Ты — руководитель отдела продаж. Разговор может быть на казахском языке или " +
    "со смешением казахского и русского — понимай смысл на обоих языках и оценивай " +
    "по сути сказанного, а не по языку. Оцени звонок менеджера СТРОГО по правилам этого " +
    "проекта. Критерии (ставь балл за каждый, не больше его максимума):\n" +
    criteria +
    script +
    '\n\nВерни СТРОГО JSON без пояснений: {"scores": {"<ключ критерия>": число, ...}, ' +
    '"notes": {"<ключ критерия>": "одна короткая фраза, почему такой балл"}, ' +
    '"summary": "2-3 предложения: что хорошо и что улучшить"}. ' +
    "notes и summary пиши ПО-РУССКИ, даже если звонок на казахском. " +
    "Используй ровно те ключи критериев, что даны выше."
  );
}

/** Общий язык-контекст: звонок может быть на казахском/смешанном. */
const LANGUAGE_NOTE =
  "Разговор может быть на казахском языке или со смешением казахского и русского — " +
  "понимай смысл на обоих языках и оценивай по сути сказанного, а не по языку. ";

/** Промпт для текстового режима: все правила одним текстом, целостная оценка 0..100. */
function buildHolisticPrompt(rubric: CallRubric): string {
  return (
    "Ты — руководитель отдела продаж. " +
    LANGUAGE_NOTE +
    "Оцени звонок менеджера от 0 до 100 по правилам отдела продаж ниже. " +
    "Учитывай, насколько менеджер их соблюдал.\n\nПРАВИЛА:\n" +
    rubric.script.trim() +
    '\n\nВерни СТРОГО JSON без пояснений: {"score": число 0-100, ' +
    '"summary": "2-3 предложения по-русски: что хорошо и что нарушено по правилам"}.'
  );
}

async function callModel(keys: AiKeys, system: string, user: string): Promise<Record<string, unknown>> {
  const useDeepseek = Boolean(keys.deepseek);
  const url = useDeepseek
    ? "https://api.deepseek.com/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = useDeepseek ? "deepseek-chat" : "gpt-4o-mini";
  const key = useDeepseek ? keys.deepseek : keys.openai;
  if (!key) throw new AiError("Нет ключа для оценки звонка (OpenAI или DeepSeek).");

  const res = await withTimeout(SCORE_TIMEOUT_MS, (signal) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal,
    }),
  ).catch(() => null);

  if (!res) throw new AiError("AI не ответил при оценке (таймаут).");
  if (!res.ok) throw new AiError(`AI-оценка: ошибка ${res.status}.`);
  const json = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
  };
  try {
    return JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new AiError("AI вернул неразборчивый ответ.");
  }
}

/** Оценка транскрипта по правилам проекта. DeepSeek предпочтителен, иначе OpenAI. */
async function score(
  transcript: string,
  durationSec: number,
  keys: AiKeys,
  rubric: CallRubric,
): Promise<CallScore> {
  const user = `Длительность звонка: ${durationSec} сек.\nТранскрипт:\n${transcript}`;

  // Текстовый режим: критериев нет, правила заданы одним текстом — целостная оценка.
  if (rubric.criteria.length === 0) {
    const parsed = await callModel(keys, buildHolisticPrompt(rubric), user);
    return {
      transcript,
      score: clampInt(parsed.score, 100),
      maxScore: 100,
      breakdown: {},
      notes: {},
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  }

  // Режим критериев: балл по каждому + обоснование.
  const parsed = (await callModel(keys, buildSystemPrompt(rubric), user)) as {
    scores?: Record<string, unknown>;
    notes?: Record<string, unknown>;
    summary?: unknown;
  };
  const scores = parsed.scores ?? {};
  const rawNotes = parsed.notes ?? {};
  const breakdown: Record<string, number> = {};
  const notes: Record<string, string> = {};
  let total = 0;
  for (const criterion of rubric.criteria) {
    const value = clampInt(scores[criterion.key], criterion.weight);
    breakdown[criterion.key] = value;
    total += value;
    const note = rawNotes[criterion.key];
    if (typeof note === "string" && note.trim()) notes[criterion.key] = note.trim();
  }

  return {
    transcript,
    score: total,
    maxScore: rubricMaxScore(rubric),
    breakdown,
    notes,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function analyzeCall({
  recordingUrl,
  durationSec,
  keys,
  rubric,
}: {
  recordingUrl: string;
  durationSec: number;
  keys: AiKeys;
  rubric: CallRubric;
}): Promise<CallScore> {
  if (!keys.openai) {
    throw new AiError("Нет ключа OpenAI — им делается транскрипция. Подключите ключ в «Интеграциях».");
  }
  const transcript = await transcribe(recordingUrl, keys.openai, rubric.language);
  if (!transcript) throw new AiError("Транскрипт пустой — проверьте, что по ссылке есть запись.");
  return score(transcript, durationSec, keys, rubric);
}
