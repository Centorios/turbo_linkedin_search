create table if not exists public.match_locks (
  search_id uuid not null,
  resume_id uuid not null,
  locked_until timestamptz not null,
  primary key (search_id, resume_id)
);

alter table public.match_locks enable row level security;

-- Candidatos más cercanos por distancia coseno, solo del usuario autenticado/propietario.
create or replace function public.match_candidates(
  p_search_id uuid,
  p_resume_id uuid,
  p_k int default 8
)
returns table (offer_id uuid, similarity double precision)
language sql
stable
as $$
  select o.id, 1 - (o.embedding <=> r.embedding) as similarity
  from public.job_search_offers o
  join public.job_searches s on s.id = o.search_id
  join public.resume_embeddings r on r.resume_id = p_resume_id and r.user_id = s.user_id
  where o.search_id = p_search_id
    and s.resume_id = p_resume_id
    and o.embedding is not null
  order by o.embedding <=> r.embedding
  limit p_k;
$$;

-- Lock con expiración (90 s) para rechazar cálculos simultáneos; devuelve false si ya hay uno vigente.
create or replace function public.try_lock_match(p_search_id uuid, p_resume_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_rows int;
begin
  insert into public.match_locks (search_id, resume_id, locked_until)
  values (p_search_id, p_resume_id, now() + interval '90 seconds')
  on conflict (search_id, resume_id) do update
    set locked_until = excluded.locked_until
    where public.match_locks.locked_until < now();
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.release_match_lock(p_search_id uuid, p_resume_id uuid)
returns void
language sql
as $$
  delete from public.match_locks where search_id = p_search_id and resume_id = p_resume_id;
$$;

-- Reemplazo atómico del resultado; p_recommendations es un array JSON de recomendaciones.
create or replace function public.save_match_result(
  p_user_id uuid,
  p_search_id uuid,
  p_resume_id uuid,
  p_resume_content_hash text,
  p_recommendations jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_result_id uuid;
  v_item jsonb;
  v_rank int := 0;
begin
  if not exists (
    select 1 from public.job_searches
    where id = p_search_id and user_id = p_user_id and resume_id = p_resume_id
  ) then
    raise exception 'search_not_found';
  end if;

  for v_item in select * from jsonb_array_elements(p_recommendations) loop
    if not exists (
      select 1 from public.job_search_offers
      where id = (v_item->>'offer_id')::uuid and search_id = p_search_id
    ) then
      raise exception 'offer_not_in_search';
    end if;
  end loop;

  insert into public.match_results (user_id, search_id, resume_id, resume_content_hash)
  values (p_user_id, p_search_id, p_resume_id, p_resume_content_hash)
  on conflict (search_id, resume_id) do update
    set resume_content_hash = excluded.resume_content_hash, created_at = now()
  returning id into v_result_id;

  delete from public.match_recommendations where result_id = v_result_id;

  for v_item in select * from jsonb_array_elements(p_recommendations) loop
    v_rank := v_rank + 1;
    insert into public.match_recommendations
      (result_id, user_id, rank, offer_id, affinity, summary, matches, unmet_requirements, missing_info)
    values (
      v_result_id, p_user_id, v_rank,
      (v_item->>'offer_id')::uuid,
      v_item->>'affinity',
      v_item->>'summary',
      coalesce(v_item->'matches', '[]'::jsonb),
      coalesce(v_item->'unmet_requirements', '[]'::jsonb),
      coalesce(v_item->'missing_info', '[]'::jsonb)
    );
  end loop;

  return v_result_id;
end;
$$;
