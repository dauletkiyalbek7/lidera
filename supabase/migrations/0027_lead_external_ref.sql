-- Идемпотентность импорта из внешних CRM (amoCRM/Bitrix): по паре
-- источник + внешний id узнаём уже импортированную сделку и обновляем её,
-- а не плодим дубли при каждой синхронизации.
alter table leads add column if not exists external_source text;
alter table leads add column if not exists external_id text;

create unique index if not exists leads_external_ref_uidx
  on leads (project_id, external_source, external_id)
  where external_source is not null and external_id is not null;
