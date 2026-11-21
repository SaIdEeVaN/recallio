\set ON_ERROR_STOP on
begin;
grant select,insert,delete on storage.objects to authenticated;
insert into auth.users (id,email) values ('c7d81c24-92ce-417d-89e6-2add875719f3','storage-a@recallio.invalid'),('4be303f1-1840-4030-9bd7-5ce091f5718d','storage-b@recallio.invalid');
insert into public.study_sets (id,user_id,title,format,status) values ('d555e50c-32c8-49bf-a4f5-c16c172978c4','c7d81c24-92ce-417d-89e6-2add875719f3','Policy fixture','PDF','queued');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c7d81c24-92ce-417d-89e6-2add875719f3"}',true) as caller \gset
insert into storage.objects(bucket_id,name) values('study-sources','c7d81c24-92ce-417d-89e6-2add875719f3/d555e50c-32c8-49bf-a4f5-c16c172978c4/source.pdf');
do $$ begin
 if (select count(*) from storage.objects where bucket_id='study-sources')<>1 then raise exception 'Owner read denied'; end if;
 begin
 insert into storage.objects(bucket_id,name) values('study-sources','c7d81c24-92ce-417d-89e6-2add875719f3/arbitrary/source.pdf');
 raise exception 'Unreserved slot accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"4be303f1-1840-4030-9bd7-5ce091f5718d"}',true) as caller \gset
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='study-sources') then raise exception 'Cross-account read'; end if;
 delete from storage.objects where bucket_id='study-sources';
 if found then raise exception 'Cross-account delete'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"c7d81c24-92ce-417d-89e6-2add875719f3"}',true) as caller \gset
do $$ begin
 delete from storage.objects where bucket_id='study-sources';
 if not found then raise exception 'Owner delete denied'; end if;
end $$;
rollback;
