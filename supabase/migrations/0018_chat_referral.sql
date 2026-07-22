-- Реклама, из которой пришла переписка.
--
-- Meta кладёт блок referral только в ПЕРВОЕ сообщение после клика по объявлению,
-- а телефон человек оставляет позже — иногда через несколько реплик. Поэтому
-- объявление запоминаем на самой переписке и переносим на лид в момент,
-- когда он заводится.
alter table chat_conversations
  add column creative_id uuid references creatives(id) on delete set null;

-- Заголовок объявления показываем в карточке переписки: менеджеру полезно
-- видеть, на что человек откликнулся, ещё до первого вопроса.
alter table chat_conversations add column ad_headline text;

create index chat_conversations_creative_idx
  on chat_conversations (project_id, creative_id);
