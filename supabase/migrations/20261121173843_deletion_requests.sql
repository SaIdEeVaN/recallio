create table public.account_deletion_requests(user_id uuid primary key default auth.uid() references auth.users on delete cascade, requested_at timestamptz not null default now());
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select,insert on public.account_deletion_requests to authenticated;
create policy owner_requests on public.account_deletion_requests for all to authenticated
using(user_id=(select auth.uid()) and (select recallio_private.backend()))
with check(user_id=(select auth.uid()) and (select recallio_private.backend()));
