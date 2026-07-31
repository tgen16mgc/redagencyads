create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function private.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.is_workspace_admin(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_workspace_admin(uuid) to authenticated;

drop policy if exists "members can read workspaces" on public.workspaces;
create policy "members can read workspaces"
on public.workspaces for select to authenticated
using (private.is_workspace_member(id));

drop policy if exists "members can read their membership" on public.workspace_members;
create policy "members can read their membership"
on public.workspace_members for select to authenticated
using (user_id = (select auth.uid()) or private.is_workspace_admin(workspace_id));

drop policy if exists "admins can manage workspace members" on public.workspace_members;
create policy "admins can manage workspace members"
on public.workspace_members for all to authenticated
using (private.is_workspace_admin(workspace_id))
with check (private.is_workspace_admin(workspace_id));

drop policy if exists "admins can manage invites" on public.workspace_invites;
create policy "admins can manage invites"
on public.workspace_invites for all to authenticated
using (private.is_workspace_admin(workspace_id))
with check (private.is_workspace_admin(workspace_id));

drop policy if exists "admins can review access requests" on public.workspace_access_requests;
create policy "admins can review access requests"
on public.workspace_access_requests for select to authenticated
using (private.is_workspace_admin(workspace_id));

drop policy if exists "admins can update access requests" on public.workspace_access_requests;
create policy "admins can update access requests"
on public.workspace_access_requests for update to authenticated
using (private.is_workspace_admin(workspace_id))
with check (private.is_workspace_admin(workspace_id));

drop policy if exists "members can record their login" on public.workspace_login_events;
create policy "members can record their login"
on public.workspace_login_events for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

drop policy if exists "admins can review login events" on public.workspace_login_events;
create policy "admins can review login events"
on public.workspace_login_events for select to authenticated
using (private.is_workspace_admin(workspace_id));

create or replace function private.handle_workspace_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pending_invite public.workspace_invites%rowtype;
  resolved_name text;
begin
  if new.email is null then
    return new;
  end if;

  select * into pending_invite
  from public.workspace_invites
  where email = lower(new.email)
    and accepted_at is null
  order by created_at
  limit 1;

  if pending_invite.id is null then
    return new;
  end if;

  resolved_name := coalesce(
    nullif(trim(pending_invite.full_name), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.workspace_members (workspace_id, user_id, email, full_name, role, status)
  values (pending_invite.workspace_id, new.id, lower(new.email), resolved_name, pending_invite.role, 'active')
  on conflict (workspace_id, user_id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      status = 'active',
      updated_at = now();

  update public.workspace_invites
  set accepted_at = coalesce(accepted_at, now())
  where id = pending_invite.id;

  return new;
end;
$$;

revoke all on function private.handle_workspace_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_workspace_invite on auth.users;
create trigger on_auth_user_workspace_invite
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function private.handle_workspace_auth_user();

create or replace function public.record_workspace_login(
  p_provider text default 'unknown',
  p_user_agent text default null
)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_workspace_id uuid;
  created_event_id bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select workspace_id into current_workspace_id
  from public.workspace_members
  where user_id = current_user_id and status = 'active'
  order by created_at
  limit 1;

  if current_workspace_id is null then
    raise exception 'Workspace access is not approved.' using errcode = '42501';
  end if;

  insert into public.workspace_login_events (workspace_id, user_id, email, provider, user_agent)
  values (
    current_workspace_id,
    current_user_id,
    current_email,
    case when p_provider in ('email', 'google') then p_provider else 'unknown' end,
    left(nullif(trim(coalesce(p_user_agent, '')), ''), 500)
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

revoke all on function public.record_workspace_login(text, text) from public, anon;
grant execute on function public.record_workspace_login(text, text) to authenticated;

revoke all on function public.request_workspace_access(text, text, text) from authenticated;

drop function if exists public.handle_workspace_auth_user();
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.is_workspace_admin(uuid);
