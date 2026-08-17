-- Correct role lookup variable name; current_role resolves to PostgreSQL CURRENT_ROLE.
create or replace function public.create_workspace_invite(
  p_email text,
  p_full_name text default null,
  p_role text default 'viewer'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_workspace_id uuid;
  actor_role text;
  normalized_email text := lower(trim(coalesce(p_email, '')));
  created_invite_id uuid;
begin
  current_workspace_id := public.ensure_workspace_membership();

  select role into actor_role
  from public.workspace_members
  where workspace_id = current_workspace_id
    and user_id = current_user_id
    and status = 'active';

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only workspace owners and admins can invite members.' using errcode = '42501';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_email) > 320 then
    raise exception 'Enter a valid work email address.' using errcode = '22023';
  end if;

  if p_role not in ('admin', 'analyst', 'viewer') then
    raise exception 'Choose a valid workspace role.' using errcode = '22023';
  end if;

  if p_full_name is not null and char_length(trim(p_full_name)) > 120 then
    raise exception 'Full name is too long.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.workspace_members
    where workspace_id = current_workspace_id
      and lower(email) = normalized_email
  ) then
    raise exception 'This person is already a workspace member.' using errcode = '23505';
  end if;

  insert into public.workspace_invites (
    workspace_id,
    email,
    full_name,
    role,
    invited_by,
    expires_at,
    accepted_at,
    revoked_at
  )
  values (
    current_workspace_id,
    normalized_email,
    nullif(trim(coalesce(p_full_name, '')), ''),
    p_role,
    current_user_id,
    now() + interval '7 days',
    null,
    null
  )
  on conflict (workspace_id, (lower(email))) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      invited_by = excluded.invited_by,
      expires_at = excluded.expires_at,
      accepted_at = null,
      revoked_at = null,
      updated_at = now()
  returning id into created_invite_id;

  return created_invite_id;
end;
$$;

revoke all on function public.create_workspace_invite(text, text, text) from public, anon;
grant execute on function public.create_workspace_invite(text, text, text) to authenticated;

create or replace function public.revoke_workspace_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_workspace_id uuid;
  actor_role text;
begin
  current_workspace_id := public.ensure_workspace_membership();

  select role into actor_role
  from public.workspace_members
  where workspace_id = current_workspace_id
    and user_id = current_user_id
    and status = 'active';

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only workspace owners and admins can revoke invitations.' using errcode = '42501';
  end if;

  update public.workspace_invites
  set revoked_at = now(),
      updated_at = now()
  where id = p_invite_id
    and workspace_id = current_workspace_id
    and accepted_at is null
    and revoked_at is null;

  return found;
end;
$$;

revoke all on function public.revoke_workspace_invite(uuid) from public, anon;
grant execute on function public.revoke_workspace_invite(uuid) to authenticated;

create or replace function public.update_workspace_member_role(
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_workspace_id uuid;
  actor_role text;
  target_role text;
begin
  current_workspace_id := public.ensure_workspace_membership();

  select role into actor_role
  from public.workspace_members
  where workspace_id = current_workspace_id
    and user_id = current_user_id
    and status = 'active';

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only workspace owners and admins can manage members.' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'analyst', 'viewer') then
    raise exception 'Choose a valid workspace role.' using errcode = '22023';
  end if;

  select role into target_role
  from public.workspace_members
  where workspace_id = current_workspace_id
    and user_id = p_user_id
    and status = 'active';

  if target_role is null then
    raise exception 'The workspace member could not be found.' using errcode = 'P0002';
  end if;

  if target_role = 'owner' then
    raise exception 'Transfer ownership before changing the owner role.' using errcode = '42501';
  end if;

  if p_user_id = current_user_id then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;

  if actor_role = 'admin' and target_role = 'admin' then
    raise exception 'Only the workspace owner can change another admin.' using errcode = '42501';
  end if;

  update public.workspace_members
  set role = p_role,
      updated_at = now()
  where workspace_id = current_workspace_id
    and user_id = p_user_id;

  return found;
end;
$$;

revoke all on function public.update_workspace_member_role(uuid, text) from public, anon;
grant execute on function public.update_workspace_member_role(uuid, text) to authenticated;

create or replace function public.remove_workspace_member(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_workspace_id uuid;
  actor_role text;
  target_role text;
begin
  current_workspace_id := public.ensure_workspace_membership();

  select role into actor_role
  from public.workspace_members
  where workspace_id = current_workspace_id
    and user_id = current_user_id
    and status = 'active';

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only workspace owners and admins can remove members.' using errcode = '42501';
  end if;

  if p_user_id = current_user_id then
    raise exception 'You cannot remove yourself from the active workspace.' using errcode = '42501';
  end if;

  select role into target_role
  from public.workspace_members
  where workspace_id = current_workspace_id
    and user_id = p_user_id
    and status = 'active';

  if target_role is null then
    raise exception 'The workspace member could not be found.' using errcode = 'P0002';
  end if;

  if target_role = 'owner' then
    raise exception 'Transfer ownership before removing the workspace owner.' using errcode = '42501';
  end if;

  if actor_role = 'admin' and target_role = 'admin' then
    raise exception 'Only the workspace owner can remove another admin.' using errcode = '42501';
  end if;

  delete from public.workspace_members
  where workspace_id = current_workspace_id
    and user_id = p_user_id;

  return found;
end;
$$;

revoke all on function public.remove_workspace_member(uuid) from public, anon;
grant execute on function public.remove_workspace_member(uuid) to authenticated;
