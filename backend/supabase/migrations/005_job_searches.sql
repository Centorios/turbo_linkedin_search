create table if not exists public.job_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  keywords text not null,
  location text,
  created_at timestamptz not null default now()
);

create index if not exists job_searches_user_resume_idx
  on public.job_searches (user_id, resume_id, created_at desc);

create table if not exists public.job_search_offers (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.job_searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,
  external_id text not null,
  title text not null,
  company text,
  location text,
  snippet text,
  url text,
  source text not null,
  source_updated_at timestamptz,
  content_hash text not null,
  embedding vector(1536),
  unique (search_id, external_id)
);

create index if not exists job_search_offers_search_idx
  on public.job_search_offers (search_id, position);

alter table public.job_searches enable row level security;
alter table public.job_search_offers enable row level security;

create policy job_searches_owner on public.job_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy job_search_offers_owner on public.job_search_offers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
