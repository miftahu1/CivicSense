create schema if not exists extensions;
create extension if not exists vector with schema extensions;

do $$ begin
  create type public.user_role as enum ('student', 'staff', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.report_status as enum ('Under review', 'Investigating', 'In progress', 'Resolved');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.report_priority as enum ('Low', 'Medium', 'High', 'Urgent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.report_language as enum ('English', 'Assamese', 'Romanised Assamese', 'Mixed');
exception when duplicate_object then null; end $$;

create sequence if not exists public.civicsense_ticket_seq;

create or replace function public.next_ticket_number()
returns text language sql volatile set search_path = public as $$
  select 'CS-' || to_char(current_date, 'YY') || lpad(nextval('public.civicsense_ticket_seq')::text, 5, '0');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'student',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'as')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issue_clusters (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  category text not null,
  location text not null,
  status public.report_status not null default 'Under review',
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default public.next_ticket_number(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  original_text text not null check (char_length(original_text) between 10 and 5000),
  original_language public.report_language not null,
  title_en text,
  title_as text,
  summary_en text,
  summary_as text,
  category text not null default 'Other',
  suggested_priority public.report_priority not null default 'Medium',
  confirmed_priority public.report_priority,
  priority_explanation text,
  department text,
  location_building text not null,
  location_area text not null default '',
  status public.report_status not null default 'Under review',
  cluster_id uuid references public.issue_clusters(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  assigned_department text,
  sensitive_flag boolean not null default false,
  is_synthetic boolean not null default false,
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'complete', 'failed')),
  analysis_confidence real check (analysis_confidence between 0 and 1),
  analysis_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  image_caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  old_status public.report_status,
  new_status public.report_status,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.report_embeddings (
  report_id uuid primary key references public.reports(id) on delete cascade,
  embedding extensions.vector(768) not null,
  model_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_reporter_created_idx on public.reports(reporter_id, created_at desc);
create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create index if not exists reports_category_idx on public.reports(category);
create index if not exists reports_building_idx on public.reports(location_building);
create index if not exists reports_cluster_idx on public.reports(cluster_id) where cluster_id is not null;
create index if not exists report_events_report_created_idx on public.report_events(report_id, created_at);
create index if not exists report_embeddings_hnsw_idx on public.report_embeddings using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at before update on public.reports for each row execute function public.set_updated_at();
drop trigger if exists issue_clusters_set_updated_at on public.issue_clusters;
create trigger issue_clusters_set_updated_at before update on public.issue_clusters for each row execute function public.set_updated_at();

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
begin
  if requested_role not in ('student', 'staff') then requested_role := 'student'; end if;
  insert into public.profiles(id, full_name, role, preferred_language)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), requested_role::public.user_role,
    case when new.raw_user_meta_data->>'preferred_language' = 'as' then 'as' else 'en' end)
  on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users for each row execute function public.create_profile_for_auth_user();

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.attachments enable row level security;
alter table public.issue_clusters enable row level security;
alter table public.report_events enable row level security;
alter table public.report_embeddings enable row level security;

drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.current_user_is_admin());
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, preferred_language) on public.profiles to authenticated;

drop policy if exists "reports read own or admin" on public.reports;
create policy "reports read own or admin" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.current_user_is_admin());
drop policy if exists "events read report owner or admin" on public.report_events;
create policy "events read report owner or admin" on public.report_events for select to authenticated using (exists (select 1 from public.reports r where r.id = report_id and (r.reporter_id = auth.uid() or public.current_user_is_admin())));
drop policy if exists "attachments read report owner or admin" on public.attachments;
create policy "attachments read report owner or admin" on public.attachments for select to authenticated using (exists (select 1 from public.reports r where r.id = report_id and (r.reporter_id = auth.uid() or public.current_user_is_admin())));
drop policy if exists "clusters admin only" on public.issue_clusters;
create policy "clusters admin only" on public.issue_clusters for select to authenticated using (public.current_user_is_admin());

create or replace function public.save_report_embedding(p_report_id uuid, p_embedding_text text, p_model_name text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.report_embeddings(report_id, embedding, model_name)
  values(p_report_id, p_embedding_text::extensions.vector, p_model_name)
  on conflict(report_id) do update set embedding = excluded.embedding, model_name = excluded.model_name, created_at = now();
end;
$$;

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
    where r.id is distinct from p_exclude_report_id and r.status <> 'Resolved'
  ), ranked as (
    select candidates.*,
      least(1.0, cosine_similarity + case when location_match then 0.025 else 0 end)::real as similarity
    from candidates
  )
  select ranked.report_id, ranked.similarity, ranked.cosine_similarity, ranked.location_match
  from ranked where ranked.similarity >= p_threshold
  order by ranked.similarity desc limit greatest(1, least(p_match_count, 3));
$$;

revoke all on function public.save_report_embedding(uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_report_embedding(uuid, text, text) to service_role;
revoke all on function public.match_reports(text, uuid, text, real, integer) from public, anon, authenticated;
grant execute on function public.match_reports(text, uuid, text, real, integer) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('report-attachments', 'report-attachments', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict(id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "report photo read owner or admin" on storage.objects;
create policy "report photo read owner or admin" on storage.objects for select to authenticated using (
  bucket_id = 'report-attachments' and exists (
    select 1 from public.reports r where r.id = (storage.foldername(name))[1]::uuid and (r.reporter_id = auth.uid() or public.current_user_is_admin())
  )
);

comment on table public.reports is 'Campus issue reports. Each original submission remains a separate record even when grouped.';
comment on table public.report_embeddings is 'Gemini Embedding 2 vectors over original-language report text and campus location, using 768 dimensions.';
