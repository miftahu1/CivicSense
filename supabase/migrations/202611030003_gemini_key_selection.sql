-- app_settings is created by the public issue board migration.
insert into public.app_settings(setting_key, setting_value)
values ('gemini_key_slot', '"primary"'::jsonb)
on conflict (setting_key) do nothing;
