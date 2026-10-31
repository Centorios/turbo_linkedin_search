create table if not exists public.user_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  storage_path text not null unique,
  original_filename text not null check (length(btrim(original_filename)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 5242880),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('pending_review', 'ready')),
  name text not null default '',
  issuer text not null default '',
  issue_date text not null default '' check (issue_date ~ '^(|[0-9]{4}|(0[1-9]|1[0-2])-[0-9]{4})$'),
  expiration_date text not null default '' check (expiration_date ~ '^(|[0-9]{4}|(0[1-9]|1[0-2])-[0-9]{4})$'),
  credential text not null default '',
  language_name text not null default '',
  language_proficiency text not null default '',
  normalized_name text not null default '',
  normalized_issuer text not null default '',
  normalized_credential text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  unique (user_id, content_sha256),
  unique (id, user_id),
  check (split_part(storage_path, '/', 1) = user_id::text),
  check (status <> 'ready' or length(btrim(name)) > 0)
);

create index if not exists user_certificates_owner_created_idx
  on public.user_certificates (user_id, created_at desc, id desc);

alter table public.user_certificates enable row level security;

drop policy if exists "Users can read own certificates" on public.user_certificates;
create policy "Users can read own certificates"
  on public.user_certificates for select to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-certificates', 'user-certificates', false, 5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own certificate files" on storage.objects;
create policy "Users can read own certificate files"
  on storage.objects for select to authenticated
  using (bucket_id = 'user-certificates' and (storage.foldername(name))[1] = (select auth.uid()::text));

alter table public.resumes
  add column if not exists request_fingerprint text,
  add column if not exists certificate_merge_report jsonb;

drop policy if exists "Users can delete own profile photos" on storage.objects;
create policy "Users can delete own profile photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and not exists (
      select 1 from public.resumes r
      where r.user_id = (select auth.uid())
        and r.data #>> '{personalInfo,photoPath}' = name
    )
  );

-- Serialize certificate identity checks for a given owner to prevent concurrent
-- uploads of the same credential with different file bytes.
create or replace function public.register_user_certificate(p_record jsonb)
returns public.user_certificates
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing public.user_certificates;
  created public.user_certificates;
  owner_id uuid := (p_record->>'user_id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtext(owner_id::text));

  select * into existing from public.user_certificates
  where user_id = owner_id
    and (request_id = (p_record->>'request_id')::uuid
      or content_sha256 = p_record->>'content_sha256'
      or (
        normalized_credential <> ''
        and normalized_credential = p_record->>'normalized_credential'
      )
      or (
        normalized_name <> ''
        and normalized_issuer <> ''
        and normalized_name = p_record->>'normalized_name'
        and normalized_issuer = p_record->>'normalized_issuer'
        and (issue_date = '' or coalesce(p_record->>'issue_date', '') = ''
             or issue_date = p_record->>'issue_date'
             or (length(issue_date) <> length(p_record->>'issue_date')
                 and right(issue_date, 4) = right(p_record->>'issue_date', 4)))
      ))
  order by created_at, id
  limit 1;

  if found then
    return existing;
  end if;

  if (select count(*) from public.user_certificates where user_id = owner_id) >= 50 then
    raise exception 'certificate_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.user_certificates (
    id, user_id, request_id, storage_path, original_filename, mime_type,
    file_size_bytes, content_sha256, status, name, issuer, issue_date,
    expiration_date, credential, language_name, language_proficiency,
    normalized_name, normalized_issuer, normalized_credential
  ) values (
    (p_record->>'id')::uuid, owner_id, (p_record->>'request_id')::uuid,
    p_record->>'storage_path', p_record->>'original_filename', p_record->>'mime_type',
    (p_record->>'file_size_bytes')::bigint, p_record->>'content_sha256',
    p_record->>'status', coalesce(p_record->>'name', ''), coalesce(p_record->>'issuer', ''),
    coalesce(p_record->>'issue_date', ''), coalesce(p_record->>'expiration_date', ''),
    coalesce(p_record->>'credential', ''), coalesce(p_record->>'language_name', ''),
    coalesce(p_record->>'language_proficiency', ''), coalesce(p_record->>'normalized_name', ''),
    coalesce(p_record->>'normalized_issuer', ''), coalesce(p_record->>'normalized_credential', '')
  ) returning * into created;
  return created;
end;
$$;

revoke all on function public.register_user_certificate(jsonb) from public, anon, authenticated;
grant execute on function public.register_user_certificate(jsonb) to service_role;
