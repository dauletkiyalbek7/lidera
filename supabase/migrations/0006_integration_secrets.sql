-- Секреты интеграций (ТЗ, раздел 3, пункт 6): ключи и токены рекламных кабинетов,
-- ботов и внешних сервисов. Хранятся зашифрованными и никогда не уходят в браузер.
create table integration_secrets (
  integration_id uuid primary key references integrations(id) on delete cascade,
  project_id     uuid not null references projects(id) on delete cascade,
  -- AES-256-GCM: шифротекст, вектор инициализации и тег целостности — по отдельности.
  ciphertext     text not null,
  iv             text not null,
  auth_tag       text not null,
  -- Последние символы ключа: человеку нужно узнать свой ключ, не видя его целиком.
  hint           text,
  updated_by     uuid references profiles(id),
  updated_at     timestamptz not null default now()
);

create index integration_secrets_project_idx on integration_secrets (project_id);

-- RLS включён, политик нет ни одной: ни anon, ни authenticated не получат отсюда
-- ни строки. Читает и пишет только сервер сервисным ключом, обходящим RLS.
alter table integration_secrets enable row level security;
