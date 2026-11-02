create or replace function public.delete_report(report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_role text;
  report_reporter_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role::text into current_user_role
  from public.profiles as p
  where p.id = current_user_id;

  select r.reporter_id into report_reporter_id
  from public.reports as r
  where r.id = report_id;

  if report_reporter_id is null then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if current_user_id = report_reporter_id or current_user_role = 'admin' then
    delete from public.reports as r where r.id = report_id;
  else
    raise exception 'User is not authorized to delete this report' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.delete_report(uuid) from public, anon;
grant execute on function public.delete_report(uuid) to authenticated;
