-- Accounts created before the auth profile trigger was installed need a
-- default student profile. Existing staff and administrator roles are kept.
insert into public.profiles(id, full_name, role, preferred_language)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Campus member'
  ),
  'student',
  case when u.raw_user_meta_data->>'preferred_language' = 'as' then 'as' else 'en' end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
