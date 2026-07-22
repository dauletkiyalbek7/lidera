-- Чат-бот (ТЗ, Блок 4): ChatPlace присылает входящие сообщения,
-- и как только в переписке появляется номер — она превращается в лид с источником.

-- Токен вебхука. Как и у приёма заявок, храним только отпечаток.
create table chat_webhooks (
  project_id       uuid primary key references projects(id) on delete cascade,
  token_hash       text not null unique,
  hint             text,
  received_count   int not null default 0,
  last_received_at timestamptz,
  issued_by        uuid references profiles(id),
  issued_at        timestamptz not null default now()
);

-- RLS включён, политик нет: токен вебхука не должен быть виден из браузера никому,
-- включая владельца. Читает и пишет только сервер сервисным ключом.
alter table chat_webhooks enable row level security;

-- Переписка с одним человеком в одном канале.
create table chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  -- Канал ChatPlace: whatsapp | instagram | facebook | telegram | other.
  channel         text not null default 'other',
  -- Идентификатор переписки на стороне ChatPlace: по нему находим её снова.
  external_id     text not null,
  contact_name    text,
  contact_phone   text,
  last_message    text,
  last_message_at timestamptz,
  message_count   int not null default 0,
  -- Лид появляется в момент, когда в переписке нашёлся номер.
  lead_id         uuid references leads(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (project_id, channel, external_id)
);

create index chat_conversations_project_idx on chat_conversations (project_id, last_message_at desc);

create table chat_messages (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  -- in — от человека, out — ответ бота или оператора.
  direction       text not null default 'in' check (direction in ('in','out')),
  body            text,
  created_at      timestamptz not null default now()
);

create index chat_messages_conversation_idx on chat_messages (conversation_id, created_at desc);

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;

create policy chat_conversations_owner on chat_conversations for all
  using (is_owner() or owns_project(project_id))
  with check (is_owner() or owns_project(project_id));

create policy chat_conversations_member_read on chat_conversations for select
  using (is_project_member(project_id));

create policy chat_messages_owner on chat_messages for all
  using (is_owner() or owns_project(project_id))
  with check (is_owner() or owns_project(project_id));

create policy chat_messages_member_read on chat_messages for select
  using (is_project_member(project_id));
