alter table public.job_searches
  add column if not exists sources text[] not null default array['jooble']::text[],
  add column if not exists status text not null default 'complete',
  add column if not exists updated_at timestamptz not null default now();

alter table public.job_searches
  drop constraint if exists job_searches_status_check,
  add constraint job_searches_status_check
    check (status in ('in_progress', 'complete', 'incomplete')),
  drop constraint if exists job_searches_sources_check,
  add constraint job_searches_sources_check
    check (sources <@ array['jooble', 'linkedin']::text[] and cardinality(sources) > 0);

create table if not exists public.job_search_source_runs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.job_searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('jooble', 'linkedin')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'timed_out')),
  apify_run_id text,
  apify_dataset_id text,
  attempts int not null default 0 check (attempts between 0 and 3),
  offers_count int not null default 0,
  cost_usd numeric,
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (search_id, source)
);

create unique index if not exists job_search_source_runs_apify_run_idx
  on public.job_search_source_runs (apify_run_id)
  where apify_run_id is not null;

create index if not exists job_search_source_runs_user_idx
  on public.job_search_source_runs (user_id, search_id);

alter table public.job_search_offers
  add column if not exists description text,
  add column if not exists description_is_partial boolean not null default false,
  add column if not exists dedup_key text,
  add column if not exists sources text[] not null default array['jooble']::text[],
  add column if not exists alternate_urls jsonb not null default '[]'::jsonb;

-- Ofertas previas (solo Jooble): su clave de deduplicación es su identificador.
update public.job_search_offers
set dedup_key = external_id,
  sources = array[lower(source)]
where dedup_key is null;

alter table public.job_search_offers
  alter column dedup_key set not null;

create unique index if not exists job_search_offers_search_dedup_idx
  on public.job_search_offers (search_id, dedup_key);

alter table public.job_search_source_runs enable row level security;

drop policy if exists job_search_source_runs_owner on public.job_search_source_runs;
create policy job_search_source_runs_owner on public.job_search_source_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
