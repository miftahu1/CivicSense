alter type public.report_status add value if not exists 'Awaiting admin review';

alter table public.profiles
  add column if not exists department text;

-- Self-registration always creates a student profile. Campus administrators
-- promote staff accounts and assign departments through the protected team UI.
create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, role, preferred_language)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    'student',
    case when new.raw_user_meta_data->>'preferred_language' = 'as' then 'as' else 'en' end
  )
  on conflict(id) do nothing;
  return new;
end;
$$;
