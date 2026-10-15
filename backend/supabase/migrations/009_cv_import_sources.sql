create table if not exists public.cv_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  storage_path text not null,
  original_filename text not null
    check (length(btrim(original_filename)) between 1 and 255),
  file_size_bytes bigint not null
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  page_count integer not null
    check (page_count between 1 and 20),
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  unique (id, user_id),
  unique (storage_path),
  check (split_part(storage_path, '/', 1) = user_id::text)
);

alter table public.cv_sources enable row level security;

drop policy if exists "Users can access own CV sources" on public.cv_sources;
create policy "Users can access own CV sources"
  on public.cv_sources
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.resumes
  add column if not exists source_id uuid,
  add column if not exists parent_resume_id uuid references public.resumes(id) on delete set null;

alter table public.resumes
  drop constraint if exists resumes_source_user_fk;

alter table public.resumes
  add constraint resumes_source_user_fk
  foreign key (source_id, user_id)
  references public.cv_sources(id, user_id)
  on delete cascade;

create index if not exists resumes_source_id_idx
  on public.resumes(source_id)
  where source_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cv-sources',
  'cv-sources',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own CV source PDFs" on storage.objects;
create policy "Users can read own CV source PDFs"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'cv-sources'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can upload own CV source PDFs" on storage.objects;
create policy "Users can upload own CV source PDFs"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'cv-sources'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can delete own CV source PDFs" on storage.objects;
create policy "Users can delete own CV source PDFs"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'cv-sources'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
