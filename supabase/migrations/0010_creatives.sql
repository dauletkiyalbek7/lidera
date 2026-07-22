-- Сквозная аналитика креативов (ТЗ, Блок 3): креатив → лид → продажа.

-- Креатив принадлежит кампании и живёт в рекламном кабинете.
alter table creatives add column campaign_id uuid references ad_campaigns(id) on delete set null;
alter table creatives add column status text;
alter table creatives add column preview_url text;
alter table creatives add column synced_at timestamptz not null default now();

-- Один креатив кабинета — одна строка. Ручные креативы без external_id не мешают.
create unique index creatives_external_key on creatives (project_id, platform, external_id)
  where external_id is not null;

-- Связь с воронкой: по ней и строится сквозная аналитика (ТЗ, раздел 8).
alter table leads add column creative_id uuid references creatives(id) on delete set null;
alter table sales add column creative_id uuid references creatives(id) on delete set null;

create index leads_creative_idx on leads (project_id, creative_id);
create index sales_creative_idx on sales (project_id, creative_id);

-- Дневная статистика по креативу. Отдельно от кампаний: гранулярность другая,
-- и складывать их в одной таблице означало бы считать расход дважды.
create table ad_creative_insights_daily (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  creative_id  uuid not null references creatives(id) on delete cascade,
  date         date not null,
  spend        numeric not null default 0,
  spend_source numeric not null default 0,
  currency     text,
  impressions  int not null default 0,
  clicks       int not null default 0,
  leads        int not null default 0,
  unique (project_id, creative_id, date)
);

create index ad_creative_insights_date_idx on ad_creative_insights_daily (project_id, date);

alter table ad_creative_insights_daily enable row level security;

create policy ad_creative_insights_owner on ad_creative_insights_daily for all
  using (is_owner() or owns_project(project_id))
  with check (is_owner() or owns_project(project_id));

create policy ad_creative_insights_member_read on ad_creative_insights_daily for select
  using (is_project_member(project_id));

create policy ad_creative_insights_director on ad_creative_insights_daily for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));

-- Креативы синхронизирует директор.
create policy creatives_director on creatives for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));
