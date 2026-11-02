alter table public.reports
  add column if not exists public_opt_out boolean not null default false;

create index if not exists reports_public_feed_idx
  on public.reports(created_at desc)
  where not sensitive_flag and not public_opt_out and not is_synthetic;

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;
grant all on public.app_settings to service_role;

insert into public.app_settings(setting_key, setting_value)
values ('public_issue_board', '{"enabled": false}'::jsonb)
on conflict (setting_key) do nothing;

create or replace view public.public_issue_feed as
select
  id,
  ticket_number,
  title_en,
  title_as,
  summary_en,
  summary_as,
  category,
  coalesce(confirmed_priority, suggested_priority) as priority,
  case coalesce(confirmed_priority, suggested_priority)
    when 'Urgent' then 4
    when 'High' then 3
    when 'Medium' then 2
    else 1
  end as priority_rank,
  location_building as building,
  location_area as area,
  status,
  created_at,
  updated_at
from public.reports
where not sensitive_flag and not public_opt_out and not is_synthetic;

revoke all on public.public_issue_feed from public, anon, authenticated;
grant select on public.public_issue_feed to service_role;
