create table if not exists public.resume_embeddings (
  resume_id uuid primary key references public.resumes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_hash text not null,
  model text not null,
  embedding vector(1536) not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  search_id uuid not null references public.job_searches(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  resume_content_hash text not null,
  created_at timestamptz not null default now(),
  unique (search_id, resume_id)
);

create table if not exists public.match_recommendations (
  result_id uuid not null references public.match_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  offer_id uuid not null references public.job_search_offers(id) on delete cascade,
  affinity text not null check (affinity in ('Alta', 'Media')),
  summary text not null,
  matches jsonb not null default '[]'::jsonb,
  unmet_requirements jsonb not null default '[]'::jsonb,
  missing_info jsonb not null default '[]'::jsonb,
  primary key (result_id, rank)
);

alter table public.resume_embeddings enable row level security;
alter table public.match_results enable row level security;
alter table public.match_recommendations enable row level security;

create policy resume_embeddings_owner on public.resume_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy match_results_owner on public.match_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy match_recommendations_owner on public.match_recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
