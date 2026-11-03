create table if not exists public.abuse_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ip_hash text,
  report_id uuid references public.reports(id) on delete set null,
  event_type text not null check (char_length(event_type) between 2 and 80),
  risk_score smallint not null default 0 check (risk_score between 0 and 100),
  details jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists abuse_events_created_at_idx on public.abuse_events (created_at desc);
create index if not exists abuse_events_user_id_idx on public.abuse_events (user_id, created_at desc);

create table if not exists public.abuse_restrictions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('account', 'ip')),
  user_id uuid references public.profiles(id) on delete cascade,
  ip_hash text,
  reason text not null check (char_length(reason) between 3 and 1000),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  lift_reason text,
  created_at timestamptz not null default now(),
  constraint abuse_restrictions_scope_target_check check (
    (scope = 'account' and user_id is not null and ip_hash is null) or
    (scope = 'ip' and ip_hash is not null and user_id is null)
  )
);

create index if not exists abuse_restrictions_account_active_idx on public.abuse_restrictions (user_id, expires_at) where lifted_at is null and scope = 'account';
create index if not exists abuse_restrictions_ip_active_idx on public.abuse_restrictions (ip_hash, expires_at) where lifted_at is null and scope = 'ip';

alter table public.abuse_rate_limits enable row level security;
alter table public.abuse_events enable row level security;
alter table public.abuse_restrictions enable row level security;
revoke all on public.abuse_rate_limits, public.abuse_events, public.abuse_restrictions from public, anon, authenticated;
grant all on public.abuse_rate_limits, public.abuse_events, public.abuse_restrictions to service_role;

create or replace function public.current_user_is_abuse_restricted()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.abuse_restrictions as restriction
    join public.profiles as profile on profile.id = auth.uid()
    where profile.role <> 'admin'
      and restriction.scope = 'account'
      and restriction.user_id = auth.uid()
      and restriction.lifted_at is null
      and (restriction.expires_at is null or restriction.expires_at > now())
  );
$$;

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self unless restricted" on public.profiles for update to authenticated
  using (id = auth.uid() and not public.current_user_is_abuse_restricted())
  with check (id = auth.uid() and not public.current_user_is_abuse_restricted());
revoke all on function public.current_user_is_abuse_restricted() from public, anon;
grant execute on function public.current_user_is_abuse_restricted() to authenticated, service_role;

create or replace function public.find_active_abuse_restriction(p_user_id uuid, p_ip_hash text default null)
returns table (restriction_id uuid, scope text, reason text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select restriction.id, restriction.scope, restriction.reason, restriction.expires_at
  from public.abuse_restrictions as restriction
  where restriction.lifted_at is null
    and (restriction.expires_at is null or restriction.expires_at > now())
    and ((restriction.scope = 'account' and restriction.user_id = p_user_id)
      or (restriction.scope = 'ip' and p_ip_hash is not null and restriction.ip_hash = p_ip_hash))
  order by case when restriction.scope = 'account' then 0 else 1 end, restriction.created_at desc
  limit 1;
$$;

revoke all on function public.find_active_abuse_restriction(uuid, text) from public, anon, authenticated;
grant execute on function public.find_active_abuse_restriction(uuid, text) to service_role;

-- Remove expired counters during normal traffic without requiring an extension or cron job.
create or replace function public.consume_abuse_rate_limit(p_bucket_key text, p_window_seconds integer, p_limit integer)
returns table (allowed boolean, request_count integer, retry_after_seconds integer)
language plpgsql security definer set search_path = public as $$
declare
  v_started_at timestamptz;
  v_count integer;
begin
  if p_window_seconds < 1 or p_window_seconds > 86400 or p_limit < 1 or p_limit > 10000 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.abuse_rate_limits as bucket (bucket_key, window_started_at, request_count, updated_at)
  values (p_bucket_key, now(), 1, now())
  on conflict (bucket_key) do update set
    window_started_at = case when bucket.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else bucket.window_started_at end,
    request_count = case when bucket.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else bucket.request_count + 1 end,
    updated_at = now()
  returning bucket.window_started_at, bucket.request_count into v_started_at, v_count;

  if mod(v_count, 100) = 0 then
    delete from public.abuse_rate_limits where updated_at < now() - interval '7 days';
  end if;

  return query select v_count <= p_limit,
    v_count,
    greatest(1, ceil(extract(epoch from (v_started_at + make_interval(secs => p_window_seconds) - now())))::integer);
end;
$$;
revoke all on function public.consume_abuse_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_abuse_rate_limit(text, integer, integer) to service_role;
