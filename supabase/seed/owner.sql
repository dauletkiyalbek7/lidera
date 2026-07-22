-- Создание аккаунта владельца платформы.
-- Публичной регистрации в Lidera нет: аккаунты выдаёт платформа,
-- поэтому первый владелец заводится этим скриптом.
--
-- Перед запуском поменяйте email, пароль и имя.
-- Профиль в public.profiles создастся сам — триггером on_auth_user_created.

do $$
declare
  new_user_id   uuid := gen_random_uuid();
  owner_email   text := 'owner@example.com';
  owner_password text := 'ЗАМЕНИТЕ_МЕНЯ';
  owner_name    text := 'Имя Фамилия';
begin
  if exists (select 1 from auth.users where email = owner_email) then
    raise notice 'Пользователь % уже существует', owner_email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    -- GoTrue читает эти поля как строки: NULL здесь ломает вход.
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    owner_email, extensions.crypt(owner_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', owner_name, 'global_role', 'owner'),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    new_user_id::text, new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', owner_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end $$;
