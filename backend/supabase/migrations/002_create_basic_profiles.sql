create table if not exists public.basic_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null default '',
  phone text not null default '',
  location text not null default '',
  linkedin text not null default '',
  website text not null default '',
  updated_at timestamptz not null default now(),
  constraint basic_profiles_full_name_not_blank check (length(btrim(full_name)) > 0)
);

alter table public.basic_profiles enable row level security;

drop policy if exists "Users can access own basic profile" on public.basic_profiles;
create policy "Users can access own basic profile"
  on public.basic_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);