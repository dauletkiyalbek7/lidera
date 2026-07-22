-- Приём лидов извне (ТЗ, Блок 3): сайт, лендинг или Tilda присылают заявку в проект.
-- Вместе с заявкой приходит метка креатива — на ней держится сквозная аналитика.

create table lead_intake (
  project_id     uuid primary key references projects(id) on delete cascade,
  -- Храним только отпечаток токена: сам токен показывается один раз при выпуске.
  -- Потерян — выпускается новый, старый перестаёт работать.
  token_hash     text not null unique,
  -- Последние символы: человеку нужно узнать свой токен, не видя его целиком.
  hint           text,
  received_count int not null default 0,
  last_received_at timestamptz,
  issued_by      uuid references profiles(id),
  issued_at      timestamptz not null default now()
);

-- RLS включён, политик нет: строку читает и пишет только сервер сервисным ключом.
-- Токен приёма не должен быть виден из браузера никому, включая владельца.
alter table lead_intake enable row level security;
