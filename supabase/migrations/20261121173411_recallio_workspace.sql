create schema if not exists recallio_private;
revoke all on schema recallio_private from public, anon, authenticated;
create table recallio_private.configuration (name text primary key, value text not null);
create function recallio_private.backend() returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from recallio_private.configuration where name='server_hash' and value=encode(sha256(convert_to(coalesce(current_setting('request.headers',true)::jsonb->>'x-recallio-server',''),'UTF8')),'hex'))
$$;
revoke all on function recallio_private.backend() from public;
grant usage on schema recallio_private to anon,authenticated;
grant execute on function recallio_private.backend() to anon,authenticated;
create table public.study_sets(
 id uuid primary key, user_id uuid not null default auth.uid() references auth.users on delete cascade,
 title text not null check(length(title) between 1 and 160), format text not null,
 status text not null default 'queued' check(status in('queued','processing','ready','failed')),
 revision int not null default 0, content jsonb not null default '{}',
 updated_at timestamptz not null default now()
);
create index study_sets_owner_updated on public.study_sets(user_id,updated_at desc);
alter table public.study_sets enable row level security;
revoke all on public.study_sets from public,anon,authenticated;
grant select,insert,update,delete on public.study_sets to authenticated;
create policy own_sets on public.study_sets for all to authenticated
 using(user_id=(select auth.uid()) and (select recallio_private.backend()))
 with check(user_id=(select auth.uid()) and (select recallio_private.backend()));
create table recallio_private.usage(day date not null, bucket text not null, n int not null, primary key(day,bucket));
create table public.study_jobs(
 user_id uuid not null default auth.uid() references auth.users on delete cascade,
 set_id uuid not null references public.study_sets on delete cascade, request_id uuid not null,
 kind text not null, status text not null, created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
create index study_jobs_set on public.study_jobs(set_id);
alter table public.study_jobs enable row level security;
revoke all on public.study_jobs from public, anon, authenticated;
grant select,insert,update,delete on public.study_jobs to authenticated;
create policy own_jobs on public.study_jobs for all to authenticated using(user_id=(select auth.uid()) and (select recallio_private.backend()))
 with check(user_id=(select auth.uid()) and exists(select 1 from public.study_sets s where s.id=set_id) and (select recallio_private.backend()));
create function public.recallio_reserve(kind text, fingerprint text) returns boolean language plpgsql security definer set search_path='' as $$
declare k text; lim int; count_now int;
begin
 if not recallio_private.backend() then raise insufficient_privilege; end if;
 if kind not in ('ai','upload','account','login') or length(fingerprint)<>64 then raise exception 'invalid operation'; end if;
 if kind in ('ai','upload') and auth.uid() is null then raise insufficient_privilege; end if;
 for k,lim in select * from (values
 (kind||':global',case when kind='ai' then 100 else 300 end),
 (kind||':ip:'||fingerprint,case kind when 'account' then 5 when 'login' then 60 when 'ai' then 40 else 12 end),
 (kind||':user:'||coalesce(auth.uid()::text,fingerprint),case kind when 'ai' then 20 when 'upload' then 5 when 'login' then 60 else 5 end)
 ) as limits(bucket,maximum) loop
 insert into recallio_private.usage values((now() at time zone 'utc')::date,k,1) on conflict(day,bucket) do update set n=recallio_private.usage.n+1 returning n into count_now;
 if count_now>lim then raise exception 'daily quota exceeded' using errcode='P0001'; end if;
 end loop;
 delete from recallio_private.usage where day<current_date-31;
 return true;
end $$;
revoke all on function public.recallio_reserve(text,text) from public;
grant execute on function public.recallio_reserve(text,text) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('study-sources','study-sources',false,5242880,array['application/pdf','text/plain']);
create policy own_originals on storage.objects for all to authenticated
 using(bucket_id='study-sources' and (storage.foldername(name))[1]=(select auth.uid())::text and (select recallio_private.backend()))
 with check(bucket_id='study-sources' and (storage.foldername(name))[1]=(select auth.uid())::text and (select recallio_private.backend()));
