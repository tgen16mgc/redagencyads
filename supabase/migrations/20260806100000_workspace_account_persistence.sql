create or replace function public.ensure_workspace_membership()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_name text := coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    split_part(current_email, '@', 1)
  );
  target_workspace_id uuid;
begin
  if current_user_id is null or current_email = '' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select workspace_id into target_workspace_id
  from public.workspace_members
  where user_id = current_user_id and status = 'active'
  order by created_at
  limit 1;

  if target_workspace_id is not null then
    return target_workspace_id;
  end if;

  select id into target_workspace_id
  from public.workspaces
  where slug = 'decision-workspace';

  if target_workspace_id is null then
    raise exception 'Workspace is not configured.' using errcode = '55000';
  end if;

  insert into public.workspace_members (workspace_id, user_id, email, full_name, role, status)
  values (target_workspace_id, current_user_id, current_email, current_name, 'viewer', 'active')
  on conflict (workspace_id, user_id) do update
  set email = excluded.email,
      full_name = case
        when trim(public.workspace_members.full_name) = '' then excluded.full_name
        else public.workspace_members.full_name
      end,
      status = 'active',
      updated_at = now();

  return target_workspace_id;
end;
$$;

revoke all on function public.ensure_workspace_membership() from public, anon;
grant execute on function public.ensure_workspace_membership() to authenticated;

create table if not exists public.workspace_connector_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('meta')),
  encrypted_token text not null,
  token_expires_at timestamptz,
  last_validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.workspace_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  account_name text not null,
  date_since date not null,
  date_until date not null,
  selected_pack text not null,
  report jsonb not null,
  previous_report jsonb,
  verdict jsonb,
  insights jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id, date_since, date_until, selected_pack)
);

drop trigger if exists set_workspace_connector_credentials_updated_at on public.workspace_connector_credentials;
create trigger set_workspace_connector_credentials_updated_at
before update on public.workspace_connector_credentials
for each row execute function public.set_workspace_updated_at();

drop trigger if exists set_workspace_report_snapshots_updated_at on public.workspace_report_snapshots;
create trigger set_workspace_report_snapshots_updated_at
before update on public.workspace_report_snapshots
for each row execute function public.set_workspace_updated_at();

alter table public.workspace_connector_credentials enable row level security;
alter table public.workspace_report_snapshots enable row level security;

drop policy if exists "members manage their connector credentials" on public.workspace_connector_credentials;
create policy "members manage their connector credentials"
on public.workspace_connector_credentials for all to authenticated
using (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

drop policy if exists "members manage their report snapshots" on public.workspace_report_snapshots;
create policy "members manage their report snapshots"
on public.workspace_report_snapshots for all to authenticated
using (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

revoke all on public.workspace_connector_credentials from anon, authenticated;
revoke all on public.workspace_report_snapshots from anon, authenticated;
grant select, insert, update, delete on public.workspace_connector_credentials to authenticated;
grant select, insert, update, delete on public.workspace_report_snapshots to authenticated;

create index if not exists workspace_report_snapshots_user_updated_idx
on public.workspace_report_snapshots (user_id, updated_at desc);
