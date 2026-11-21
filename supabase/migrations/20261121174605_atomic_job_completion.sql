-- The counter function is internal. Its public entry point runs with the caller's rights.
alter function public.recallio_reserve(text,text) set schema recallio_private;
revoke execute on function recallio_private.recallio_reserve(text,text) from anon;
create function public.recallio_reserve(kind text,fingerprint text) returns boolean
language sql security invoker set search_path='' as $$
 select recallio_private.recallio_reserve(kind,fingerprint)
$$;
revoke all on function public.recallio_reserve(text,text) from public,anon;
grant execute on function public.recallio_reserve(text,text) to authenticated;
create function public.recallio_finish_job(target uuid,request_key uuid,expected int,patch jsonb)
returns setof public.study_sets language plpgsql security invoker set search_path='' as $$
begin
 update public.study_jobs set status='complete' where request_id=request_key and set_id=target and user_id=(select auth.uid()) and status='working';
 if not found then raise exception 'job changed'; end if;
 return query update public.study_sets set content=patch,revision=revision+1,updated_at=now() where id=target and revision=expected and user_id=(select auth.uid()) returning *;
 if not found then raise exception 'revision conflict'; end if;
end $$;
revoke all on function public.recallio_finish_job(uuid,uuid,int,jsonb) from public,anon;
grant execute on function public.recallio_finish_job(uuid,uuid,int,jsonb) to authenticated;
create unique index study_sets_source_hash on public.study_sets(user_id,(content->>'hash')) where status='ready' and content ? 'hash';
create function public.recallio_find_evidence(target uuid,question text) returns setof jsonb
language sql stable security invoker set search_path='' as $$
 select chunk from public.study_sets s cross join lateral jsonb_array_elements(s.content->'chunks') chunk
 where s.id=target and s.user_id=(select auth.uid())
 order by (position(lower(chunk->>'id') in lower(question))>0) desc,
 ts_rank_cd(to_tsvector('english',chunk->>'text'),websearch_to_tsquery('english',left(question,2000))) desc,
 (chunk->>'start')::integer limit 8
$$;
revoke all on function public.recallio_find_evidence(uuid,text) from public,anon;
grant execute on function public.recallio_find_evidence(uuid,text) to authenticated;
