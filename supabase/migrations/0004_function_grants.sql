-- Хелперы RLS не должны быть доступны анонимному пользователю через REST.
-- Роли authenticated право нужно: политики вызывают функции в контексте текущего пользователя.
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.is_project_member(uuid) from public, anon;
revoke execute on function public.owns_project(uuid) from public, anon;
revoke execute on function public.can_view_profile(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.owns_project(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
