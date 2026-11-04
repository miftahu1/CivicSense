create table if not exists public.category_department_routes (
  category text primary key,
  department text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.category_department_routes enable row level security;
revoke all on public.category_department_routes from anon, authenticated;
grant all on public.category_department_routes to service_role;

insert into public.category_department_routes (category, department) values
  ('Infrastructure', 'Facilities & Maintenance'),
  ('Utilities', 'Facilities & Maintenance'),
  ('Safety and Security', 'Campus Security'),
  ('Transportation', 'Transport & Parking'),
  ('Environmental', 'Sanitation & Waste'),
  ('Administrative', null),
  ('Student Life', 'Student Housing'),
  ('Faculty Support', null),
  ('Events and Activities', 'Facilities & Maintenance'),
  ('Technology and IT', 'IT Services'),
  ('Health and Wellness', 'Health Services'),
  ('Other', null)
on conflict (category) do nothing;

comment on table public.category_department_routes is 'Administrator-managed default department routing by AI-confirmed report category. Null department routes to admin triage.';
