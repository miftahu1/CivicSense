alter type public.report_status add value if not exists 'Investigating';

alter table public.reports
  add column if not exists assigned_department text;

alter table public.attachments
  drop constraint if exists attachments_size_bytes_check;

alter table public.attachments
  add constraint attachments_size_bytes_check
  check (size_bytes between 1 and 15728640);

update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic']
where id = 'report-attachments';
