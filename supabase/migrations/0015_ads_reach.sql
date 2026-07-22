-- Охват: сколько разных людей увидело рекламу. Из него считается частота
-- (показы ÷ охват) — сколько раз в среднем человек увидел объявление.
alter table ad_insights_daily add column reach int not null default 0;
alter table ad_creative_insights_daily add column reach int not null default 0;
