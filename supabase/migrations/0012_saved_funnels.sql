-- Сохранённые рабочие воронки (ТЗ, Блок 3: Marketing Dashboard).
-- Воронка — это именованный срез: источник, креатив и период.
create table saved_funnels (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  source        text,
  creative_id   uuid references creatives(id) on delete set null,
  range_preset  text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  unique (project_id, name)
);

create index saved_funnels_project_idx on saved_funnels (project_id);

alter table saved_funnels enable row level security;

create policy saved_funnels_owner on saved_funnels for all
  using (is_owner() or owns_project(project_id))
  with check (is_owner() or owns_project(project_id));

create policy saved_funnels_member_read on saved_funnels for select
  using (is_project_member(project_id));

create policy saved_funnels_director on saved_funnels for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));
