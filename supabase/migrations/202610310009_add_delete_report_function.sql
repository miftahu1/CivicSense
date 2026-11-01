create or replace function delete_report(report_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  user_id uuid;
  user_role text;
  report_reporter_id uuid;
begin
  select auth.uid() into user_id;
  select role from app_users where id = user_id into user_role;
  select reporter_id from reports where id = report_id into report_reporter_id;

  if user_id = report_reporter_id or user_role = 'admin' then
    delete from reports where id = report_id;
  else
    raise exception 'User is not authorized to delete this report';
  end if;
end;
$$;

grant execute on function delete_report(uuid) to authenticated;
