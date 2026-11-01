alter table public.reports add column if not exists image_analysis_status text not null default 'pending' check (image_analysis_status in ('pending', 'in_progress', 'complete', 'failed'));
