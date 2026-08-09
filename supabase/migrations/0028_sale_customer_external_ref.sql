-- Идемпотентность импорта продаж и клиентов из внешних CRM (amoCRM/Bitrix):
-- по паре источник + внешний id обновляем существующую запись, а не дублируем.
alter table sales add column if not exists external_source text;
alter table sales add column if not exists external_id text;
alter table customers add column if not exists external_source text;
alter table customers add column if not exists external_id text;

create unique index if not exists sales_external_ref_uidx
  on sales (project_id, external_source, external_id)
  where external_source is not null and external_id is not null;

create unique index if not exists customers_external_ref_uidx
  on customers (project_id, external_source, external_id)
  where external_source is not null and external_id is not null;
