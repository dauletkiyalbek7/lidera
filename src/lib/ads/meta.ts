/**
 * Клиент Meta Marketing API (ТЗ, Блок 3).
 * Разбор ответов написан по живым данным реального кабинета, а не по документации:
 * поля у кампаний без открутки отсутствуют целиком, а лиды приходят разными
 * типами действий — у лид-форм один, у переписок в WhatsApp и Direct другой.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
/** Сколько кампаний тянем за раз: у активного кабинета их сотни. */
const PAGE_LIMIT = 200;

export type MetaAccount = {
  id: string;
  name: string;
  /** Валюта кабинета: у одного проекта она может отличаться от валюты бизнеса. */
  currency: string;
};

export type MetaCampaign = {
  externalId: string;
  name: string;
  status: string | null;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
};

export type MetaDailyInsight = {
  campaignId: string;
  date: string;
  spend: number;
  impressions: number;
  /** Сколько разных людей увидело рекламу в этот день. */
  reach: number;
  clicks: number;
  leads: number;
};

export type MetaAction = { action_type: string; value: string | number };

/**
 * Заявки с лид-форм и с сайта. Meta присылает их сразу несколькими типами,
 * которые пересекаются между собой, поэтому берём максимум, а не сумму.
 */
const FORM_LEAD_ACTIONS = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
] as const;

/**
 * Начатые переписки. Для кампаний на WhatsApp и Direct это и есть заявка:
 * поля lead у них нет вообще, и без этой строки половина лидов теряется.
 */
const MESSAGING_LEAD_ACTIONS = [
  "onsite_conversion.messaging_conversation_started_7d",
] as const;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(actions: readonly MetaAction[], type: string): number {
  const found = actions.find((action) => action.action_type === type);
  return found ? toNumber(found.value) : 0;
}

/**
 * Лиды дня по кампании: заявки плюс переписки.
 * Пересекающиеся типы схлопываем максимумом, непересекающиеся складываем.
 */
export function countLeads(actions: readonly MetaAction[] | undefined): number {
  if (!actions || actions.length === 0) return 0;

  const formLeads = Math.max(
    ...FORM_LEAD_ACTIONS.map((type) => actionValue(actions, type)),
    0,
  );
  const messaging = MESSAGING_LEAD_ACTIONS.reduce(
    (sum, type) => sum + actionValue(actions, type),
    0,
  );

  return Math.round(formLeads + messaging);
}

/** Бюджеты приходят в минорных единицах: 2500 означает 25,00 $. */
function fromMinorUnits(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toNumber(value);
  return parsed > 0 ? parsed / 100 : null;
}

export class MetaApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaApiError";
  }
}

type GraphResponse<T> = {
  data?: T[];
  error?: { message?: string; type?: string; code?: number };
  paging?: { next?: string };
};

async function graphGet<T>(url: string, token: string): Promise<GraphResponse<T>> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Ответ Meta кэшировать нельзя: цифры меняются в течение дня.
    cache: "no-store",
  });

  const payload = (await response.json()) as GraphResponse<T>;

  if (!response.ok || payload.error) {
    throw new MetaApiError(
      payload.error?.message ?? `Meta ответила ошибкой ${response.status}.`,
    );
  }

  return payload;
}

/** «act_123» и «123» — оба варианта встречаются в кабинетах, приводим к одному. */
export function normalizeAccountId(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

export async function fetchAccount(token: string, accountId: string): Promise<MetaAccount> {
  const account = normalizeAccountId(accountId);
  const url = `${GRAPH_URL}/${account}?fields=id,name,currency`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    id?: string;
    name?: string;
    currency?: string;
    error?: { message?: string };
  };

  if (!response.ok || payload.error) {
    throw new MetaApiError(
      payload.error?.message ?? `Не удалось прочитать кабинет ${account}.`,
    );
  }

  return {
    id: payload.id ?? account,
    name: payload.name ?? account,
    currency: payload.currency ?? "USD",
  };
}

type RawCampaign = {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export async function fetchCampaigns(
  token: string,
  accountId: string,
): Promise<MetaCampaign[]> {
  const account = normalizeAccountId(accountId);
  const url =
    `${GRAPH_URL}/${account}/campaigns` +
    `?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget` +
    `&limit=${PAGE_LIMIT}`;

  // Страницы обязательны: у активного кабинета кампаний больше двухсот,
  // и без обхода итог по кампаниям выходил ниже, чем по их же группам.
  const rows: RawCampaign[] = [];
  let next: string | undefined = url;
  while (next) {
    const payload: GraphResponse<RawCampaign> = await graphGet<RawCampaign>(next, token);
    rows.push(...(payload.data ?? []));
    next = payload.paging?.next;
  }

  return rows.map((campaign) => ({
    externalId: campaign.id,
    name: campaign.name ?? "Без названия",
    status: campaign.effective_status ?? campaign.status ?? null,
    objective: campaign.objective ?? null,
    dailyBudget: fromMinorUnits(campaign.daily_budget),
    lifetimeBudget: fromMinorUnits(campaign.lifetime_budget),
  }));
}

type RawInsight = {
  campaign_id?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: MetaAction[];
};

/**
 * Дневная статистика по кампаниям за период.
 * time_increment=1 даёт по строке на кампанию и день — ровно то, что ложится в базу.
 */
export async function fetchDailyInsights(
  token: string,
  accountId: string,
  since: string,
  until: string,
): Promise<MetaDailyInsight[]> {
  const account = normalizeAccountId(accountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const url =
    `${GRAPH_URL}/${account}/insights` +
    `?level=campaign&time_increment=1&time_range=${timeRange}` +
    `&fields=campaign_id,spend,impressions,reach,clicks,actions&limit=${PAGE_LIMIT}`;

  const rows: RawInsight[] = [];
  let next: string | undefined = url;
  // Страниц может быть несколько: кампаний много, а период длинный.
  while (next) {
    const payload: GraphResponse<RawInsight> = await graphGet<RawInsight>(next, token);
    rows.push(...(payload.data ?? []));
    next = payload.paging?.next;
  }

  return rows
    .filter((row): row is RawInsight & { campaign_id: string; date_start: string } =>
      Boolean(row.campaign_id && row.date_start),
    )
    .map((row) => ({
      campaignId: row.campaign_id,
      date: row.date_start,
      spend: toNumber(row.spend),
      impressions: Math.round(toNumber(row.impressions)),
      reach: Math.round(toNumber(row.reach)),
      clicks: Math.round(toNumber(row.clicks)),
      leads: countLeads(row.actions),
    }));
}

export type MetaAd = {
  externalId: string;
  name: string;
  status: string | null;
  campaignExternalId: string | null;
  adSetExternalId: string | null;
  previewUrl: string | null;
};

type RawAd = {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  preview_shareable_link?: string;
  adset_id?: string;
};

/** Объявления кабинета — это и есть креативы для сквозной аналитики (ТЗ, Блок 3). */
export async function fetchAds(token: string, accountId: string): Promise<MetaAd[]> {
  const account = normalizeAccountId(accountId);
  const url =
    `${GRAPH_URL}/${account}/ads` +
    `?fields=id,name,status,effective_status,campaign_id,adset_id,preview_shareable_link` +
    `&limit=${PAGE_LIMIT}`;

  const rows: RawAd[] = [];
  let next: string | undefined = url;
  while (next) {
    const payload: GraphResponse<RawAd> = await graphGet<RawAd>(next, token);
    rows.push(...(payload.data ?? []));
    next = payload.paging?.next;
  }

  return rows.map((ad) => ({
    externalId: ad.id,
    name: ad.name ?? "Без названия",
    status: ad.effective_status ?? ad.status ?? null,
    campaignExternalId: ad.campaign_id ?? null,
    adSetExternalId: ad.adset_id ?? null,
    previewUrl: ad.preview_shareable_link ?? null,
  }));
}

export type MetaAdDailyInsight = MetaDailyInsight & { adId: string };

type RawAdInsight = RawInsight & { ad_id?: string };

/** Дневная статистика по объявлениям: та же логика лидов, что и у кампаний. */
export async function fetchAdDailyInsights(
  token: string,
  accountId: string,
  since: string,
  until: string,
): Promise<MetaAdDailyInsight[]> {
  const account = normalizeAccountId(accountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const url =
    `${GRAPH_URL}/${account}/insights` +
    `?level=ad&time_increment=1&time_range=${timeRange}` +
    `&fields=ad_id,campaign_id,spend,impressions,reach,clicks,actions&limit=${PAGE_LIMIT}`;

  const rows: RawAdInsight[] = [];
  let next: string | undefined = url;
  while (next) {
    const payload: GraphResponse<RawAdInsight> = await graphGet<RawAdInsight>(next, token);
    rows.push(...(payload.data ?? []));
    next = payload.paging?.next;
  }

  return rows
    .filter((row): row is RawAdInsight & { ad_id: string; date_start: string } =>
      Boolean(row.ad_id && row.date_start),
    )
    .map((row) => ({
      adId: row.ad_id,
      campaignId: row.campaign_id ?? "",
      date: row.date_start,
      spend: toNumber(row.spend),
      impressions: Math.round(toNumber(row.impressions)),
      reach: Math.round(toNumber(row.reach)),
      clicks: Math.round(toNumber(row.clicks)),
      leads: countLeads(row.actions),
    }));
}

/* --------------------------- группы объявлений --------------------------- */

export type MetaAdSet = {
  externalId: string;
  name: string;
  status: string | null;
  campaignExternalId: string | null;
  /** Куда ведёт группа: WHATSAPP, INSTAGRAM_PROFILE, WEBSITE… */
  destination: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
};

type RawAdSet = {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  destination_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export async function fetchAdSets(token: string, accountId: string): Promise<MetaAdSet[]> {
  const account = normalizeAccountId(accountId);
  const url =
    `${GRAPH_URL}/${account}/adsets` +
    `?fields=id,name,status,effective_status,campaign_id,destination_type,daily_budget,lifetime_budget` +
    `&limit=${PAGE_LIMIT}`;

  const rows: RawAdSet[] = [];
  let next: string | undefined = url;
  while (next) {
    const payload: GraphResponse<RawAdSet> = await graphGet<RawAdSet>(next, token);
    rows.push(...(payload.data ?? []));
    next = payload.paging?.next;
  }

  return rows.map((set) => ({
    externalId: set.id,
    name: set.name ?? "Без названия",
    status: set.effective_status ?? set.status ?? null,
    campaignExternalId: set.campaign_id ?? null,
    // UNDEFINED означает «Meta не сказала» — это не назначение, и хранить его незачем.
    destination:
      set.destination_type && set.destination_type !== "UNDEFINED"
        ? set.destination_type
        : null,
    dailyBudget: fromMinorUnits(set.daily_budget),
    lifetimeBudget: fromMinorUnits(set.lifetime_budget),
  }));
}

export type MetaAdSetDailyInsight = MetaDailyInsight & { adSetId: string };

type RawAdSetInsight = RawInsight & { adset_id?: string };

export async function fetchAdSetDailyInsights(
  token: string,
  accountId: string,
  since: string,
  until: string,
): Promise<MetaAdSetDailyInsight[]> {
  const account = normalizeAccountId(accountId);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const url =
    `${GRAPH_URL}/${account}/insights` +
    `?level=adset&time_increment=1&time_range=${timeRange}` +
    `&fields=adset_id,campaign_id,spend,impressions,reach,clicks,actions&limit=${PAGE_LIMIT}`;

  const rows: RawAdSetInsight[] = [];
  let next: string | undefined = url;
  while (next) {
    const payload: GraphResponse<RawAdSetInsight> = await graphGet<RawAdSetInsight>(next, token);
    rows.push(...(payload.data ?? []));
    next = payload.paging?.next;
  }

  return rows
    .filter((row): row is RawAdSetInsight & { adset_id: string; date_start: string } =>
      Boolean(row.adset_id && row.date_start),
    )
    .map((row) => ({
      adSetId: row.adset_id,
      campaignId: row.campaign_id ?? "",
      date: row.date_start,
      spend: toNumber(row.spend),
      impressions: Math.round(toNumber(row.impressions)),
      reach: Math.round(toNumber(row.reach)),
      clicks: Math.round(toNumber(row.clicks)),
      leads: countLeads(row.actions),
    }));
}
