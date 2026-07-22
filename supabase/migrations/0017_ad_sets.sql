-- Группы объявлений: средний уровень между кампанией и объявлением.
-- На нём же живёт назначение трафика (destination_type): WhatsApp, сайт, форма.
create table ad_sets (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  platform         text not null default 'meta',
  external_id      text not null,
  campaign_id      uuid references ad_campaigns(id) on delete cascade,
  name             text not null,
  status           text,
  destination      text,
  daily_budget     numeric,
  lifetime_budget  numeric,
  currency         text,
  synced_at        timestamptz not null default now(),
  unique (project_id, platform, external_id)
);

create index ad_sets_project_idx on ad_sets (project_id);
create index ad_sets_campaign_idx on ad_sets (campaign_id);

create table ad_set_insights_daily (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  ad_set_id    uuid not null references ad_sets(id) on delete cascade,
  date         date not null,
  spend        numeric not null default 0,
  spend_source numeric not null default 0,
  currency     text,
  impressions  int not null default 0,
  reach        int not null default 0,
  clicks       int not null default 0,
  leads        int not null default 0,
  unique (project_id, ad_set_id, date)
);

create index ad_set_insights_date_idx on ad_set_insights_daily (project_id, date);

alter table creatives add column ad_set_id uuid references ad_sets(id) on delete set null;

alter table ad_sets enable row level security;
alter table ad_set_insights_daily enable row level security;

create policy ad_sets_owner on ad_sets for all
  using (is_owner() or owns_project(project_id))
  with check (is_owner() or owns_project(project_id));

create policy ad_sets_member_read on ad_sets for select
  using (is_project_member(project_id));

create policy ad_sets_director on ad_sets for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));

create policy ad_set_insights_owner on ad_set_insights_daily for all
  using (is_owner() or owns_project(project_id))
  with check (is_owner() or owns_project(project_id));

create policy ad_set_insights_member_read on ad_set_insights_daily for select
  using (is_project_member(project_id));

create policy ad_set_insights_director on ad_set_insights_daily for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));
