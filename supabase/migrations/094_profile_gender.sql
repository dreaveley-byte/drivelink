alter table profiles add column if not exists gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say'));
