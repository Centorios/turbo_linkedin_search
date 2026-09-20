create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

alter table public.resumes enable row level security;

drop policy if exists "Users can access own resume records" on public.resumes;
create policy "Users can access own resume records"
  on public.resumes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
