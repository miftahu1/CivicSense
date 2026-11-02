-- Let administrators review a broader set of possible cluster members.
-- The final grouping remains an explicit administrator decision.
create or replace function public.match_reports(
  p_query_embedding text,
  p_exclude_report_id uuid default null,
  p_location_building text default null,
  p_threshold real default 0.82,
  p_match_count integer default 10
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
  from ranked
  where ranked.similarity >= p_threshold
  order by ranked.cosine_similarity desc, ranked.location_match desc
  limit greatest(1, least(p_match_count, 10));
$$;

revoke all on function public.match_reports(text, uuid, text, real, integer) from public, anon, authenticated;
grant execute on function public.match_reports(text, uuid, text, real, integer) to service_role;
