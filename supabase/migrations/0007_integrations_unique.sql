-- У проекта одна строка на провайдера: подключение либо есть, либо его нет.
-- Без этого ограничения повторное подключение плодило бы дубли.
alter table integrations add constraint integrations_project_provider_key
  unique (project_id, provider);
