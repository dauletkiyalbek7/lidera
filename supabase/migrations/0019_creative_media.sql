-- Миниатюра объявления и тип материала.
--
-- Без картинки «Аналитика креативов» превращается в список названий вроде
-- «2» или «Копия — Копия», по которым владелец не узнает свой ролик.
-- thumbnail_url Meta отдаёт и для видео — это кадр из ролика.
alter table creatives add column thumbnail_url text;
alter table creatives add column media_type text
  check (media_type in ('video', 'image'));
