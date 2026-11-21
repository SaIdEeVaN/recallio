-- Signed upload slots are issued against an existing, quota-reserved draft.
-- Storage authorization uses the verified user JWT and the exact object name.
create function recallio_private.source_slot(object_name text,writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.study_sets s
 where s.user_id=(select auth.uid()) and s.format in ('PDF','TXT')
 and object_name=s.user_id::text||'/'||s.id::text||'/source.'||lower(s.format)
 and (not writing or s.status in ('queued','failed')))
$$;
revoke all on function recallio_private.source_slot(text,boolean) from public,anon;
grant execute on function recallio_private.source_slot(text,boolean) to authenticated;
drop policy own_originals on storage.objects;
create policy read_own_original on storage.objects for select to authenticated using(bucket_id='study-sources' and recallio_private.source_slot(name,false));
create policy write_own_original on storage.objects for insert to authenticated with check(bucket_id='study-sources' and recallio_private.source_slot(name,true));
create policy remove_own_original on storage.objects for delete to authenticated using(bucket_id='study-sources' and recallio_private.source_slot(name,false));
