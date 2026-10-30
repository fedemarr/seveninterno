-- Supabase projects may grant functions to anon through default privileges.
-- Revoke those grants explicitly, not only the PostgreSQL PUBLIC role.
revoke all on function public.is_admin() from public,anon,authenticated;
grant execute on function public.is_admin() to authenticated,service_role;
revoke all on function public.admin_snapshot() from public,anon,authenticated;
grant execute on function public.admin_snapshot() to authenticated,service_role;
