-- Keep any records from an earlier synthetic walkthrough out of live campus views.
alter table public.issue_clusters
  add column if not exists is_synthetic boolean not null default false;

update public.issue_clusters c
set is_synthetic = true
where exists (
  select 1 from public.reports r
  where r.cluster_id = c.id
)
and not exists (
  select 1 from public.reports r
  where r.cluster_id = c.id and not r.is_synthetic
);

-- Atomic per-account rolling-window throttle for report submissions.
create table if not exists public.report_submission_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  submissions integer not null default 0 check (submissions >= 0),
  updated_at timestamptz not null default now()
);

alter table public.report_submission_limits enable row level security;
revoke all on public.report_submission_limits from public, anon, authenticated;
grant all on public.report_submission_limits to service_role;

create or replace function public.consume_report_submission_slot(p_user_id uuid, p_limit integer default 10)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if p_user_id is null or p_limit < 1 or p_limit > 100 then
    return false;
  end if;

  insert into public.report_submission_limits as limits(user_id, window_started_at, submissions, updated_at)
  values (p_user_id, now(), 1, now())
  on conflict (user_id) do update
    set window_started_at = case
          when limits.window_started_at <= now() - interval '1 hour' then now()
          else limits.window_started_at
        end,
        submissions = case
          when limits.window_started_at <= now() - interval '1 hour' then 1
          else limits.submissions + 1
        end,
        updated_at = now()
  returning submissions <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_report_submission_slot(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_report_submission_slot(uuid, integer) to service_role;

-- Synthetic sample records never participate in live semantic matching.
create or replace function public.match_reports(
  p_query_embedding text,
  p_exclude_report_id uuid default null,
  p_location_building text default null,
  p_threshold real default 0.82,
  p_match_count integer default 3
)
returns table(report_id uuid, similarity real, cosine_similarity real, location_match boolean)
language sql stable security definer set search_path = public, extensions as $$
  with candidates as (
    select r.id as report_id,
      (1 - (e.embedding <=> p_query_embedding::extensions.vector))::real as cosine_similarity,
      (lower(trim(r.location_building)) = lower(trim(coalesce(p_location_building, '')))) as location_match
    from public.report_embeddings e
    join public.reports r on r.id = e.report_id
    where r.id is distinct from p_exclude_report_id
      and r.status <> 'Resolved'
      and not r.is_synthetic
  ), ranked as (
    select candidates.*,
      least(1.0, cosine_similarity + case when location_match then 0.025 else 0 end)::real as similarity
    from candidates
  )
  select ranked.report_id, ranked.similarity, ranked.cosine_similarity, ranked.location_match
  from ranked where ranked.similarity >= p_threshold
  order by ranked.similarity desc limit greatest(1, least(p_match_count, 3));
$$;

revoke all on function public.match_reports(text, uuid, text, real, integer) from public, anon, authenticated;
grant execute on function public.match_reports(text, uuid, text, real, integer) to service_role;
