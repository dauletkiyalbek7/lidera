"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addDays, today } from "@/lib/date-range";
import { LEAD_STATUS_FLOW, type Niche, type ProjectRole } from "@/lib/domain";
import type { TablesInsert } from "@/lib/database.types";

/**
 * Генератор демо-данных: наполняет проект так же, как это позже сделают Meta и TikTok.
 * Пишет в metrics_daily, leads, customers и sales — UI при переходе на реальные данные не меняется.
 */

const METRICS_DAYS = 90;
const LEAD_DAYS = 30;
const LEADS_PER_DAY = { min: 6, max: 18 } as const;

const DEMO_STAFF: Record<Niche, { role: ProjectRole; name: string }[]> = {
  education: [
    { role: "manager", name: "Айгерим Сериковна" },
    { role: "manager", name: "Данияр Абенов" },
    { role: "salesperson", name: "Мадина Ержанова" },
    { role: "salesperson", name: "Тимур Оспанов" },
  ],
  ecommerce: [
    { role: "manager", name: "Асель Куанышева" },
    { role: "manager", name: "Ержан Тулегенов" },
  ],
};

const LEAD_NAMES = [
  "Алия Нурланова", "Бекзат Сагындыков", "Виктория Ким", "Гульнара Абдуллаева",
  "Дамир Есенов", "Елена Соколова", "Жанна Мукашева", "Зарина Ахметова",
  "Ильяс Байжанов", "Камила Досжан", "Леонид Петров", "Марат Жумабеков",
  "Нурсултан Алиев", "Ольга Иванова", "Полина Ким", "Рустем Каиров",
  "Салтанат Оразова", "Тимур Ибрагимов", "Ульяна Морозова", "Фарида Сулейменова",
];

const SOURCES = ["meta", "meta", "tiktok", "tiktok", "whatsapp", "other"];

/** Демо-каталог склада для ниши ecommerce: по нему же идут продажи. */
const DEMO_CATALOG = [
  { name: "Парфюм Aventus, 100 мл", sku: "AVN-100", cost: 42_000, price: 89_000, stock: 24 },
  { name: "Парфюм Sauvage, 60 мл", sku: "SVG-060", cost: 21_000, price: 46_000, stock: 8 },
  { name: "Набор миниатюр, 5×10 мл", sku: "SET-005", cost: 9_500, price: 24_000, stock: 3 },
  { name: "Парфюм Baccarat, 70 мл", sku: "BCR-070", cost: 51_000, price: 112_000, stock: 0 },
  { name: "Парфюм Bleu, 50 мл", sku: "BLU-050", cost: 18_000, price: 39_000, stock: 41 },
] as const;

const PRODUCTS: Record<Niche, readonly string[]> = {
  education: [
    "Английский Beginner, 3 мес.",
    "Английский Intermediate, 6 мес.",
    "IELTS Intensive, 4 мес.",
    "Разговорный клуб, 3 мес.",
  ],
  ecommerce: DEMO_CATALOG.map((item) => item.name),
};

const PRICE_RANGE: Record<Niche, { min: number; max: number }> = {
  education: { min: 120_000, max: 480_000 },
  ecommerce: { min: 18_000, max: 95_000 },
};

export type DemoDataState = { error: string | null; message: string | null };

/** Детерминированный генератор: повторный запуск даёт те же цифры. */
function createRandom(seed: string) {
  let state = 0;
  for (const char of seed) state = (state * 31 + char.charCodeAt(0)) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

function between(random: () => number, min: number, max: number): number {
  return Math.round(min + random() * (max - min));
}

/**
 * Демо-сотрудники нужны для блоков «Топ менеджеров» и «Топ продажников».
 * Аккаунты создаются только при заданном сервисном ключе — иначе демо идёт без сотрудников.
 */
async function ensureDemoStaff(
  projectId: string,
  niche: Niche,
): Promise<{ managers: string[]; salespeople: string[]; created: number }> {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", projectId)
    .eq("status", "active");

  const managers = (existing ?? []).filter((m) => m.role === "manager").map((m) => m.user_id);
  const salespeople = (existing ?? [])
    .filter((m) => m.role === "salesperson")
    .map((m) => m.user_id);

  const missing = DEMO_STAFF[niche].filter((person) =>
    person.role === "manager"
      ? managers.length < 2
      : salespeople.length < 2 && niche === "education",
  );

  if (missing.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { managers, salespeople, created: 0 };
  }

  const admin = createSupabaseAdminClient();
  const projectKey = projectId.slice(0, 8);
  let created = 0;

  for (const [index, person] of missing.entries()) {
    const email = `demo.${person.role}.${index + 1}.${projectKey}@lidera.demo`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `Demo-${projectKey}-${index + 1}`,
      email_confirm: true,
      user_metadata: { full_name: person.name, global_role: person.role },
    });

    if (error || !data.user) continue;

    await admin.from("project_members").insert({
      project_id: projectId,
      user_id: data.user.id,
      role: person.role,
    });

    if (person.role === "manager") managers.push(data.user.id);
    else salespeople.push(data.user.id);
    created += 1;
  }

  return { managers, salespeople, created };
}

/** Демо-креативы: без них «Аналитика креативов» открывается пустой. */
const DEMO_CREATIVES: Record<Niche, string[]> = {
  education: [
    "Видео · отзыв ученика",
    "Видео · урок за 60 секунд",
    "Баннер · разговорный за 3 месяца",
    "Карусель · до и после",
    "Видео · преподаватель о методике",
  ],
  ecommerce: [
    "Видео · распаковка флакона",
    "Баннер · стойкость 12 часов",
    "Карусель · топ-5 ароматов",
    "Видео · отзыв покупателя",
    "Баннер · подарочный набор",
  ],
};

/** Доля лидов без метки креатива: так бывает в жизни, и это видно на экране. */
const UNATTRIBUTED_SHARE = 0.18;

/** Создаёт демо-креативы один раз и возвращает их id. */
async function ensureDemoCreatives(projectId: string, niche: Niche): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("creatives")
    .select("id")
    .eq("project_id", projectId);

  if ((existing ?? []).length > 0) return (existing ?? []).map((row) => row.id);

  const { data } = await supabase
    .from("creatives")
    .insert(
      DEMO_CREATIVES[niche].map((name) => ({
        project_id: projectId,
        name,
        platform: "meta",
        status: "ACTIVE",
      })),
    )
    .select("id");

  return (data ?? []).map((row) => row.id);
}

/** Правила начисления по ролям — чтобы «Зарплаты» открывались с готовым расчётом. */
const DEMO_SALARY_RULES: Record<Niche, Record<string, {
  base: number;
  percent: number;
  perTrial: number;
  perLead: number;
}>> = {
  education: {
    director: { base: 500_000, percent: 1, perTrial: 0, perLead: 0 },
    rop: { base: 350_000, percent: 1, perTrial: 0, perLead: 0 },
    manager: { base: 180_000, percent: 0, perTrial: 3_000, perLead: 500 },
    salesperson: { base: 200_000, percent: 3, perTrial: 0, perLead: 0 },
  },
  ecommerce: {
    director: { base: 400_000, percent: 1, perTrial: 0, perLead: 0 },
    manager: { base: 150_000, percent: 4, perTrial: 0, perLead: 300 },
  },
};

/** Сколько дней табеля наполняем демо-данными. */
const ATTENDANCE_DAYS = 14;

/**
 * HR-часть демо: правила зарплаты, недельный график и табель посещаемости.
 * Всё через upsert — повторное нажатие кнопки не плодит дубли.
 */
async function seedHrDemo(
  projectId: string,
  niche: Niche,
  staffIds: readonly string[],
  random: () => number,
  lastDay: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const rules = Object.entries(DEMO_SALARY_RULES[niche]).map(([role, rule]) => ({
    project_id: projectId,
    role,
    base_salary: rule.base,
    percent_of_sales: rule.percent,
    per_trial: rule.perTrial,
    per_qualified_lead: rule.perLead,
  }));

  // Правила ролей уникальны частичным индексом, поэтому чистим и пишем заново.
  await supabase.from("salary_rules").delete().eq("project_id", projectId).is("user_id", null);
  await supabase.from("salary_rules").insert(rules);

  if (staffIds.length === 0) return;

  const shifts = staffIds.flatMap((userId) =>
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      project_id: projectId,
      user_id: userId,
      weekday,
      starts_at: weekday <= 5 ? "09:00" : null,
      ends_at: weekday <= 5 ? "18:00" : null,
      is_dayoff: weekday > 5,
    })),
  );

  await supabase.from("work_shifts").upsert(shifts, { onConflict: "project_id,user_id,weekday" });

  const attendance = [];
  for (const userId of staffIds) {
    for (let offset = ATTENDANCE_DAYS - 1; offset >= 0; offset -= 1) {
      const date = addDays(lastDay, -offset);
      const weekday = new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
      const roll = random();
      const status =
        weekday === 0 || weekday === 6
          ? "dayoff"
          : roll < 0.82
            ? "present"
            : roll < 0.92
              ? "late"
              : roll < 0.97
                ? "sick"
                : "absent";

      attendance.push({ project_id: projectId, user_id: userId, date, status });
    }
  }

  await supabase
    .from("attendance")
    .upsert(attendance, { onConflict: "project_id,user_id,date" });
}

export async function seedDemoData(
  _prevState: DemoDataState,
  formData: FormData,
): Promise<DemoDataState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { project, niche, canManage, user } = await requireProjectContext(projectId);

  if (!canManage) {
    return { error: "Демо-данные может заполнить только владелец проекта.", message: null };
  }

  const supabase = await createSupabaseServerClient();
  const random = createRandom(projectId);
  const lastDay = today();
  const staff = await ensureDemoStaff(projectId, niche);
  const creativeIds = await ensureDemoCreatives(projectId, niche);

  // 1. Лиды: их статусы задают воронку, из них же считаются метрики свежих дней,
  //    иначе карточки дашборда и списки CRM показывали бы разные цифры.
  const flow = LEAD_STATUS_FLOW[niche];
  const price = PRICE_RANGE[niche];
  const leads: TablesInsert<"leads">[] = [];

  for (let offset = LEAD_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(lastDay, -offset);
    const count = between(random, 4, 12);
    for (let index = 0; index < count; index += 1) {
      const status = pick(random, flow);
      leads.push({
        project_id: projectId,
        full_name: pick(random, LEAD_NAMES),
        phone: `+7 7${between(random, 10, 79)} ${between(random, 100, 999)} ${between(random, 10, 99)} ${between(random, 10, 99)}`,
        source: pick(random, SOURCES),
        status,
        assigned_to: staff.managers.length > 0 ? pick(random, staff.managers) : null,
        value: status === "sale" ? between(random, price.min, price.max) : 0,
        // Часть лидов оставляем без креатива: в жизни метка долетает не всегда.
        creative_id:
          creativeIds.length > 0 && random() > UNATTRIBUTED_SHARE
            ? pick(random, creativeIds)
            : null,
        created_at: `${date}T${String(between(random, 9, 20)).padStart(2, "0")}:00:00+05:00`,
      });
    }
  }

  const { data: insertedLeads, error: leadsError } = await supabase
    .from("leads")
    .insert(leads)
    .select("id, full_name, phone, value, created_at, status, creative_id");

  if (leadsError) {
    return { error: "Не удалось создать лиды. Попробуйте ещё раз.", message: null };
  }

  // 2. Метрики по дням — источник цифр для дашборда.
  //    Свежие дни считаем по реальным лидам, ранние достраиваем правдоподобным фоном.
  const dailyFromLeads = new Map<string, Omit<TablesInsert<"metrics_daily">, "project_id" | "date">>();
  for (const lead of leads) {
    const date = String(lead.created_at).slice(0, 10);
    const stage = flow.indexOf(lead.status ?? "new");
    const current = dailyFromLeads.get(date) ?? {
      leads: 0,
      qualified: 0,
      trial_lessons: 0,
      sales: 0,
      revenue: 0,
      ad_spend: 0,
    };
    current.leads = (current.leads ?? 0) + 1;
    if (stage >= 1) current.qualified = (current.qualified ?? 0) + 1;
    if (niche === "education" && stage >= 2) {
      current.trial_lessons = (current.trial_lessons ?? 0) + 1;
    }
    if (lead.status === "sale") {
      current.sales = (current.sales ?? 0) + 1;
      current.revenue = Number(current.revenue ?? 0) + Number(lead.value ?? 0);
    }
    dailyFromLeads.set(date, current);
  }

  const metrics: TablesInsert<"metrics_daily">[] = [];
  for (let offset = METRICS_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(lastDay, -offset);
    const fromLeads = dailyFromLeads.get(date);

    if (fromLeads) {
      metrics.push({
        project_id: projectId,
        date,
        ...fromLeads,
        ad_spend: Math.round((fromLeads.leads ?? 0) * between(random, 1_200, 3_400)),
      });
      continue;
    }

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.7 : 1;
    const growth = 1 + (METRICS_DAYS - offset) / (METRICS_DAYS * 2);

    const dayLeads = Math.max(
      1,
      Math.round(between(random, LEADS_PER_DAY.min, LEADS_PER_DAY.max) * weekendFactor * growth),
    );
    const qualified = Math.round(dayLeads * (0.45 + random() * 0.25));
    const trialLessons = niche === "education" ? Math.round(qualified * (0.5 + random() * 0.3)) : 0;
    const salesBase = niche === "education" ? trialLessons : qualified;
    const daySales = Math.round(salesBase * (0.25 + random() * 0.25));

    metrics.push({
      project_id: projectId,
      date,
      leads: dayLeads,
      qualified,
      trial_lessons: trialLessons,
      sales: daySales,
      revenue: daySales * between(random, price.min, price.max),
      ad_spend: Math.round(dayLeads * between(random, 1_200, 3_400)),
    });
  }

  const { error: metricsError } = await supabase
    .from("metrics_daily")
    .upsert(metrics, { onConflict: "project_id,date" });

  if (metricsError) {
    return { error: "Лиды созданы, но метрики записать не удалось.", message: null };
  }

  const soldLeads = (insertedLeads ?? []).filter((lead) => lead.status === "sale");

  const customers: TablesInsert<"customers">[] = soldLeads.map((lead) => ({
    project_id: projectId,
    full_name: lead.full_name,
    phone: lead.phone,
    first_purchase_at: lead.created_at,
    total_spent: Number(lead.value ?? 0),
  }));

  const { data: insertedCustomers } = customers.length
    ? await supabase.from("customers").insert(customers).select("id")
    : { data: [] as { id: string }[] };

  const sellers = staff.salespeople.length > 0 ? staff.salespeople : staff.managers;
  const sales: TablesInsert<"sales">[] = soldLeads.map((lead, index) => ({
    project_id: projectId,
    lead_id: lead.id,
    customer_id: insertedCustomers?.[index]?.id ?? null,
    seller_id: sellers.length > 0 ? pick(random, sellers) : null,
    product: pick(random, PRODUCTS[niche]),
    amount: Number(lead.value ?? 0),
    // Продажа наследует креатив своего лида — на этом и держится сквозная аналитика.
    creative_id: lead.creative_id,
    created_at: lead.created_at,
  }));

  if (sales.length > 0) {
    await supabase.from("sales").insert(sales);
  }

  // 3.5. Дневная статистика креативов: расход дня делим между креативами
  //       пропорционально их лидам, чтобы сумма сошлась с metrics_daily.
  if (creativeIds.length > 0) {
    const spendByDate = new Map(metrics.map((row) => [row.date, Number(row.ad_spend ?? 0)]));
    const leadsByDateCreative = new Map<string, Map<string, number>>();

    for (const lead of leads) {
      if (!lead.creative_id) continue;
      const date = String(lead.created_at).slice(0, 10);
      const perCreative = leadsByDateCreative.get(date) ?? new Map<string, number>();
      perCreative.set(lead.creative_id, (perCreative.get(lead.creative_id) ?? 0) + 1);
      leadsByDateCreative.set(date, perCreative);
    }

    const creativeInsights = [];
    for (const [date, perCreative] of leadsByDateCreative) {
      const dayLeads = [...perCreative.values()].reduce((sum, value) => sum + value, 0);
      const daySpend = spendByDate.get(date) ?? 0;

      // Округляем вниз, а остаток раздаём по одному — иначе сумма долей
      // разойдётся с расходом дня из metrics_daily, и экраны покажут разные цифры.
      const entries = [...perCreative.entries()];
      const exact = entries.map(([, leadCount]) =>
        dayLeads > 0 ? (daySpend * leadCount) / dayLeads : 0,
      );
      const spends = exact.map((value) => Math.floor(value));
      let remainder = Math.round(daySpend - spends.reduce((sum, value) => sum + value, 0));
      const order = exact
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction);
      for (let i = 0; remainder > 0 && i < order.length; i += 1, remainder -= 1) {
        spends[order[i].index] += 1;
      }

      for (const [position, [creativeId, leadCount]] of entries.entries()) {
        const spend = spends[position];
        creativeInsights.push({
          project_id: projectId,
          creative_id: creativeId,
          date,
          spend,
          spend_source: spend,
          currency: project.currency,
          // Показы и клики правдоподобны, но производны от лидов: одна цифра — один источник.
          impressions: leadCount * between(random, 260, 520),
          clicks: leadCount * between(random, 4, 11),
          leads: leadCount,
        });
      }
    }

    if (creativeInsights.length > 0) {
      await supabase
        .from("ad_creative_insights_daily")
        .upsert(creativeInsights, { onConflict: "project_id,creative_id,date" });
    }
  }

  // 4. Склад: только у ниши ecommerce и только если каталог ещё пуст.
  let productsCreated = 0;
  if (niche === "ecommerce") {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    if ((count ?? 0) === 0) {
      const { error: productsError } = await supabase.from("products").insert(
        DEMO_CATALOG.map((item) => ({
          project_id: projectId,
          name: item.name,
          sku: item.sku,
          stock_quantity: item.stock,
          cost_price: item.cost,
          sale_price: item.price,
          low_stock_threshold: 5,
        })),
      );
      if (!productsError) productsCreated = DEMO_CATALOG.length;
    }
  }

  // 5. HR: правила начисления по ролям и табель за последние две недели,
  //    иначе «Зарплаты» и «Посещаемость» открываются пустыми и смотреть в них нечего.
  await seedHrDemo(projectId, niche, [...staff.managers, ...staff.salespeople], random, lastDay);

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "project.demo_seeded",
    details: {
      metrics_days: metrics.length,
      leads: leads.length,
      sales: sales.length,
      staff_created: staff.created,
      products_created: productsCreated,
    },
  });

  revalidatePath(`/p/${projectId}`, "layout");

  const staffNote =
    staff.created > 0
      ? ` Создано демо-сотрудников: ${staff.created}.`
      : staff.managers.length === 0
        ? " Сотрудники не создавались: не задан SUPABASE_SERVICE_ROLE_KEY, блоки «Топ» останутся пустыми."
        : "";

  const productsNote =
    productsCreated > 0 ? ` Товаров на складе: ${productsCreated}.` : "";

  return {
    error: null,
    message: `Готово. ${project.name}: ${metrics.length} дней метрик, ${leads.length} лидов, ${sales.length} продаж.${productsNote}${staffNote}`,
  };
}
