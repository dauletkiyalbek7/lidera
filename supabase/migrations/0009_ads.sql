-- Реклама (ТЗ, Блок 3): кампании Meta Ads и TikTok Ads и их дневная статистика.

-- Курс пересчёта валюты рекламного кабинета в валюту проекта.
-- Кабинет Meta может вестись в долларах, а проект считать в тенге —
-- без пересчёта расход нельзя складывать с доходом.
alter table projects add column ad_spend_rate numeric not null default 1
  check (ad_spend_rate > 0);

comment on column projects.ad_spend_rate is
  'Сколько единиц валюты проекта в одной единице валюты рекламного кабинета';

create table ad_campaigns (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  platform       text not null check (platform in ('meta','tiktok')),
  external_id    text not null,
  name           text not null,
  status         text,
  objective      text,
  daily_budget   numeric,
  lifetime_budget numeric,
  -- Валюта кабинета: бюджеты приходят именно в ней.
  currency       text,
  synced_at      timestamptz not null default now(),
  unique (project_id, platform, external_id)
);

create index ad_campaigns_project_idx on ad_campaigns (project_id, platform);

-- Дневная статистика кампании. spend уже пересчитан в валюту проекта,
-- spend_source хранит исходную сумму — чтобы было видно, откуда взялась цифра.
create table ad_insights_daily (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  campaign_id  uuid not null references ad_campaigns(id) on delete cascade,
  date         date not null,
  spend        numeric not null default 0,
  spend_source numeric not null default 0,
  currency     text,
  impressions  int not null default 0,
  clicks       int not null default 0,
  -- Лиды рекламного кабинета: заявки с форм и начатые переписки.
  leads        int not null default 0,
  unique (project_id, campaign_id, date)
);

create index ad_insights_daily_date_idx on ad_insights_daily (project_id, date);

do $$
declare
  tbl text;
  tables text[] := array['ad_campaigns','ad_insights_daily'];
begin
  foreach tbl in array tables loop
    execute format('alter table %I enable row level security', tbl);
    execute format(
      'create policy %I on %I for all using (is_owner() or owns_project(project_id)) '
      || 'with check (is_owner() or owns_project(project_id))',
      tbl || '_owner', tbl
    );
    execute format(
      'create policy %I on %I for select using (is_project_member(project_id))',
      tbl || '_member_read', tbl
    );
  end loop;
end $$;

-- Синхронизацию запускает директор проекта.
create policy ad_campaigns_director on ad_campaigns for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));

create policy ad_insights_director on ad_insights_daily for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));
