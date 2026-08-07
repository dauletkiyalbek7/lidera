import "server-only";

import { readIntegrationCredentialsAsPlatform } from "@/lib/queries/integrations";

/**
 * Глубокие данные одного креатива из Meta по запросу (ТЗ, Блок 3).
 *
 * Тянем только при открытии панели деталей: ссылку на видео и метрики удержания
 * (как смотрят ролик — «первые секунды»). Держать это в синке было бы дорого:
 * поля тяжёлые, а нужны редко. Токен кабинета — только на сервере.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

async function graph(path: string, token: string): Promise<Record<string, unknown> | null> {
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as Record<string, unknown>;
    return json;
  } catch {
    return null;
  }
}

/** Метрики Meta приходят массивом [{action_type, value}] — берём первое значение. */
function actionValue(raw: unknown): number {
  if (Array.isArray(raw) && raw[0] && typeof raw[0] === "object") {
    const value = (raw[0] as { value?: unknown }).value;
    return value != null ? Number(value) : 0;
  }
  return 0;
}

export type CreativeHook = {
  impressions: number;
  /** Запуски проигрывания. */
  plays: number;
  /** Досмотрели ≥15 сек или до конца. */
  thruplays: number;
  /** Среднее время просмотра, сек. */
  avgWatch: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
};

export type CreativeInsight = {
  video: boolean;
  /** Ссылка на ролик в Meta (для встраивания плеера и открытия). */
  permalink: string | null;
  hook: CreativeHook | null;
};

/** adId — это creatives.external_id (id объявления кабинета). */
export async function loadCreativeInsightFromMeta(
  projectId: string,
  adId: string,
): Promise<CreativeInsight | null> {
  const credentials = await readIntegrationCredentialsAsPlatform(projectId, "meta");
  if (!credentials) return null;
  const token = credentials.token;

  let video = false;
  let permalink: string | null = null;

  const creativeInfo = await graph(`${adId}?fields=creative{video_id}`, token);
  const creative = creativeInfo?.creative as { video_id?: string } | undefined;
  if (creative?.video_id) {
    video = true;
    const videoInfo = await graph(`${creative.video_id}?fields=permalink_url`, token);
    const link = videoInfo?.permalink_url;
    if (typeof link === "string" && link) {
      permalink = link.startsWith("http") ? link : `https://www.facebook.com${link}`;
    }
  }

  const insights = await graph(
    `${adId}/insights?fields=impressions,video_play_actions,video_thruplay_watched_actions,` +
      `video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,` +
      `video_p75_watched_actions,video_p100_watched_actions&date_preset=maximum`,
    token,
  );
  const row = Array.isArray(insights?.data) ? (insights?.data[0] as Record<string, unknown>) : null;

  const hook: CreativeHook | null = row
    ? {
        impressions: Number(row.impressions ?? 0),
        plays: actionValue(row.video_play_actions),
        thruplays: actionValue(row.video_thruplay_watched_actions),
        avgWatch: actionValue(row.video_avg_time_watched_actions),
        p25: actionValue(row.video_p25_watched_actions),
        p50: actionValue(row.video_p50_watched_actions),
        p75: actionValue(row.video_p75_watched_actions),
        p100: actionValue(row.video_p100_watched_actions),
      }
    : null;

  return { video, permalink, hook };
}
