-- Звонки и их AI-оценка (ТЗ, Блок 2: «Анализ звонков»).
-- Записи приходят из внешней CRM (amoCRM/Bitrix) или загружаются ссылкой;
-- транскрипт и балл проставляет AI (OpenAI/DeepSeek).
create table if not exists calls (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  external_source text,                 -- 'amocrm' | 'bitrix' | null (ручная)
  external_id    text,
  employee_id    uuid references profiles(id),   -- чей звонок, если известно
  phone          text,
  direction      text,                  -- 'in' | 'out' | null
  duration_sec   int not null default 0,
  recording_url  text,
  transcript     text,
  score          int,                   -- итоговый балл 0..100
  breakdown      jsonb,                  -- {greeting, structure, duration, ...}
  summary        text,
  status         text not null default 'new'
                   check (status in ('new','analyzing','done','failed')),
  analyzed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists calls_external_ref_uidx
  on calls (project_id, external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists calls_project_created_idx on calls (project_id, created_at desc);

alter table calls enable row level security;

create policy calls_owner  on calls for all    using (is_owner());
create policy calls_member on calls for select using (is_project_member(project_id));
