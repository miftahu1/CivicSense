alter table public.reports
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_accuracy_meters double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_location_latitude_range') then
    alter table public.reports
      add constraint reports_location_latitude_range
      check (location_latitude is null or location_latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_location_longitude_range') then
    alter table public.reports
      add constraint reports_location_longitude_range
      check (location_longitude is null or location_longitude between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_location_coordinates_pair') then
    alter table public.reports
      add constraint reports_location_coordinates_pair
      check ((location_latitude is null) = (location_longitude is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_location_accuracy_range') then
    alter table public.reports
      add constraint reports_location_accuracy_range
      check (location_accuracy_meters is null or location_accuracy_meters between 0 and 25000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_location_accuracy_requires_coordinates') then
    alter table public.reports
      add constraint reports_location_accuracy_requires_coordinates
      check (location_accuracy_meters is null or location_latitude is not null);
  end if;
end $$;

comment on column public.reports.location_latitude is 'Optional user-approved one-time browser location; never exposed through the public issue feed.';
comment on column public.reports.location_longitude is 'Optional user-approved one-time browser location; never exposed through the public issue feed.';
comment on column public.reports.location_accuracy_meters is 'Browser-reported accuracy radius in meters for an optional location pin.';
