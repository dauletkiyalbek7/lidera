import "server-only";

import type { AiKeys } from "@/lib/ai/keys";

/**
 * AI-оценка звонка (ТЗ, Блок 2: «Анализ звонков»).
 * Два шага: транскрипция (OpenAI Whisper — только у OpenAI есть речь-в-текст)
 * и оценка разговора по рубрике (DeepSeek, если ключ есть — он дешевле; иначе
 * OpenAI). Возвращает балл 0..100, разбивку и краткое резюме на русском.
 */

export class AiError extends Error {}

const TRANSCRIBE_TIMEOUT_MS = 55_000;
const SCORE_TIMEOUT_MS = 40_000;

export type CallBreakdown = {
  greeting: number; // приветствие и установление контакта, 0..20
  needs: number; // выявление потребности, 0..25
  structure: number; // структура и презентация, 0..25
  closing: number; // работа с возражениями и закрытие, 0..30
};

export type CallScore = {
  transcript: string;
  score: number;
  breakdown: CallBreakdown;
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
async function transcribe(recordingUrl: string, openaiKey: string): Promise<string> {
  const audio = await withTimeout(TRANSCRIBE_TIMEOUT_MS, (signal) =>
    fetch(recordingUrl, { signal, cache: "no-store" }),
  ).catch(() => null);
  if (!audio || !audio.ok) throw new AiError("Не удалось скачать запись звонка по ссылке.");

  const blob = await audio.blob();
  const form = new FormData();
  form.append("file", blob, "call.mp3");
  form.append("model", "whisper-1");

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

const RUBRIC =
  "Ты — руководитель отдела продаж. Оцени звонок менеджера по транскрипту. " +
  "Верни СТРОГО JSON без пояснений: " +
  '{"greeting": число 0-20, "needs": число 0-25, "structure": число 0-25, ' +
  '"closing": число 0-30, "summary": "2-3 предложения на русском: что хорошо и что улучшить"}. ' +
  "greeting — приветствие и контакт; needs — выявление потребности; " +
  "structure — структура и презентация; closing — работа с возражениями и закрытие/следующий шаг.";

function clampInt(value: unknown, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/** Оценка транскрипта. DeepSeek предпочтителен (дешевле), иначе OpenAI. */
async function score(transcript: string, durationSec: number, keys: AiKeys): Promise<CallScore> {
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
          { role: "system", content: RUBRIC },
          {
            role: "user",
            content: `Длительность звонка: ${durationSec} сек.\nТранскрипт:\n${transcript}`,
          },
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
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiError("AI вернул неразборчивый ответ.");
  }

  const breakdown: CallBreakdown = {
    greeting: clampInt(parsed.greeting, 20),
    needs: clampInt(parsed.needs, 25),
    structure: clampInt(parsed.structure, 25),
    closing: clampInt(parsed.closing, 30),
  };
  const total = breakdown.greeting + breakdown.needs + breakdown.structure + breakdown.closing;

  return {
    transcript,
    score: total,
    breakdown,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function analyzeCall({
  recordingUrl,
  durationSec,
  keys,
}: {
  recordingUrl: string;
  durationSec: number;
  keys: AiKeys;
}): Promise<CallScore> {
  if (!keys.openai) {
    throw new AiError("Нет ключа OpenAI — им делается транскрипция. Подключите ключ в «Интеграциях».");
  }
  const transcript = await transcribe(recordingUrl, keys.openai);
  if (!transcript) throw new AiError("Транскрипт пустой — проверьте, что по ссылке есть запись.");
  return score(transcript, durationSec, keys);
}
