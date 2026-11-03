-- Fix the INSERT target alias used by the atomic abuse rate limiter.
-- Safe to apply after 202611030002_abuse_protection.sql; it preserves all counters.
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
