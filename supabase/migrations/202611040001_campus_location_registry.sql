create table if not exists public.campus_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  location_type text not null default 'Campus facility' check (char_length(btrim(location_type)) between 2 and 60),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists campus_locations_name_normalized_uidx
  on public.campus_locations (lower(btrim(name)));

alter table public.campus_locations enable row level security;
revoke all on public.campus_locations from anon, authenticated;
grant all on public.campus_locations to service_role;

insert into public.campus_locations (name, location_type, latitude, longitude)
select seed.name, seed.location_type, seed.latitude, seed.longitude
from (values
  ('Core Building', 'Academic building', 27.4516224::double precision, 94.8904499::double precision),
  ('Central Library', 'Library', 27.4491203, 94.8972403),
  ('Conference Hall', 'Event venue', 27.4513640, 94.8906323),
  ('Kasi Engineering Works', 'Workshop', 27.4521158, 94.8899245),
  ('ECE Dept', 'Academic department', 27.4517885, 94.8909662),
  ('CSE Department', 'Academic department', 27.4519120, 94.8913300),
  ('Cafeteria', 'Food service', 27.4514407, 94.8915479),
  ('Dept. Petroleum Engineering', 'Academic department', 27.4508528, 94.8909022),
  ('Dept. Pharmaceutical Sciences', 'Academic department', 27.4504003, 94.8912331),
  ('Animal House Facility', 'Research facility', 27.4506475, 94.8921726),
  ('Dept. Education', 'Academic department', 27.4510732, 94.8928803),
  ('Dept. Life Science', 'Academic department', 27.4508075, 94.8944118),
  ('DU Haat', 'Market', 27.4473019, 94.8920230),
  ('Market Complex', 'Market', 27.4487921, 94.8913052),
  ('Residential Campus Gate', 'Gate', 27.4519703, 94.8887219)
) as seed(name, location_type, latitude, longitude)
where not exists (
  select 1 from public.campus_locations current
  where lower(btrim(current.name)) = lower(btrim(seed.name))
);

comment on table public.campus_locations is 'Canonical campus location registry for report forms and map resolution.';
