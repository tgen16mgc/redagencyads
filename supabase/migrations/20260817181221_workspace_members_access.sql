alter table public.workspace_members
  add column if not exists is_current boolean not null default false;

alter table public.workspace_invites
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists revoked_at timestamptz;

update public.workspace_members
set is_current = false
where status <> 'active';

with ranked_memberships as (
  select
    workspace_id,
    user_id,
    row_number() over (partition by user_id order by created_at, workspace_id) as position
  from public.workspace_members
  where status = 'active'
)
update public.workspace_members as member
set is_current = ranked.position = 1
from ranked_memberships as ranked
where member.workspace_id = ranked.workspace_id
  and member.user_id = ranked.user_id;

create unique index if not exists workspace_members_one_current_per_user_idx
  on public.workspace_members (user_id)
  where is_current;

create index if not exists workspace_members_user_status_idx
  on public.workspace_members (user_id, status, is_current desc);

create index if not exists workspace_invites_pending_email_idx
  on public.workspace_invites (lower(email), created_at)
  where accepted_at is null and revoked_at is null;

create index if not exists workspace_invites_invited_by_idx
  on public.workspace_invites (invited_by)
  where invited_by is not null;

create index if not exists workspace_connector_credentials_workspace_idx
  on public.workspace_connector_credentials (workspace_id);

create index if not exists workspace_report_snapshots_workspace_idx
  on public.workspace_report_snapshots (workspace_id, updated_at desc);

create index if not exists workspace_login_events_workspace_idx
  on public.workspace_login_events (workspace_id, signed_in_at desc);

create index if not exists workspace_access_requests_handled_by_idx
  on public.workspace_access_requests (handled_by)
  where handled_by is not null;

alter table public.workspace_connector_credentials
  drop constraint if exists workspace_connector_credentials_user_id_provider_key;

alter table public.workspace_connector_credentials
  add constraint workspace_connector_credentials_workspace_user_provider_key
  unique (workspace_id, user_id, provider);

alter table public.workspace_report_snapshots
  drop constraint if exists workspace_report_snapshots_user_id_account_id_date_since_da_key;

alter table public.workspace_report_snapshots
  add constraint workspace_report_snapshots_workspace_user_account_period_key
  unique (workspace_id, user_id, account_id, date_since, date_until, selected_pack);

create or replace function private.claim_workspace_invites(
  target_user_id uuid,
  target_email text,
  target_name text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pending_invite public.workspace_invites%rowtype;
  normalized_email text := lower(trim(coalesce(target_email, '')));
  resolved_name text := coalesce(
    nullif(trim(target_name), ''),
    split_part(normalized_email, '@', 1),
    'Workspace member'
  );
  has_current boolean;
  claimed_count integer := 0;
begin
  if target_user_id is null or normalized_email = '' then
    return 0;
  end if;

  for pending_invite in
    select *
    from public.workspace_invites
    where lower(email) = normalized_email
      and accepted_at is null
      and revoked_at is null
      and expires_at > now()
    order by created_at, id
    for update
  loop
    select exists (
      select 1
      from public.workspace_members
      where user_id = target_user_id
        and status = 'active'
        and is_current
    ) into has_current;

    insert into public.workspace_members (
      workspace_id,
      user_id,
      email,
      full_name,
      role,
      status,
      is_current
    )
    values (
      pending_invite.workspace_id,
      target_user_id,
      normalized_email,
      coalesce(nullif(trim(pending_invite.full_name), ''), resolved_name),
      pending_invite.role,
      'active',
      not has_current
    )
    on conflict (workspace_id, user_id) do update
    set email = excluded.email,
        full_name = case
          when trim(public.workspace_members.full_name) = '' then excluded.full_name
          else public.workspace_members.full_name
        end,
        role = excluded.role,
        status = 'active',
        updated_at = now();

    update public.workspace_invites
    set accepted_at = now(),
        updated_at = now()
    where id = pending_invite.id;

    claimed_count := claimed_count + 1;
  end loop;

  return claimed_count;
end;
$$;

revoke all on function private.claim_workspace_invites(uuid, text, text) from public, anon, authenticated;

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

  perform private.claim_workspace_invites(current_user_id, current_email, current_name);

  update public.workspace_members
  set is_current = false,
      updated_at = now()
  where user_id = current_user_id
    and status <> 'active'
    and is_current;

  select workspace_id into target_workspace_id
  from public.workspace_members
  where user_id = current_user_id
    and status = 'active'
    and is_current
  limit 1;

  if target_workspace_id is not null then
    return target_workspace_id;
  end if;

  select workspace_id into target_workspace_id
  from public.workspace_members
  where user_id = current_user_id
    and status = 'active'
  order by created_at, workspace_id
  limit 1;

  if target_workspace_id is not null then
    update public.workspace_members
    set is_current = workspace_id = target_workspace_id,
        updated_at = now()
    where user_id = current_user_id;
    return target_workspace_id;
  end if;

  select id into target_workspace_id
  from public.workspaces
  where slug = 'decision-workspace';

  if target_workspace_id is null then
    raise exception 'Workspace is not configured.' using errcode = '55000';
  end if;

  update public.workspace_members
  set is_current = false,
      updated_at = now()
  where user_id = current_user_id
    and is_current;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    email,
    full_name,
    role,
    status,
    is_current
  )
  values (
    target_workspace_id,
    current_user_id,
    current_email,
    current_name,
    'viewer',
    'active',
    true
  )
  on conflict (workspace_id, user_id) do update
  set email = excluded.email,
      full_name = case
        when trim(public.workspace_members.full_name) = '' then excluded.full_name
        else public.workspace_members.full_name
      end,
      status = 'active',
      is_current = true,
      updated_at = now();

  return target_workspace_id;
end;
$$;

revoke all on function public.ensure_workspace_membership() from public, anon;
grant execute on function public.ensure_workspace_membership() to authenticated;

create or replace function public.switch_workspace(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = current_user_id
      and status = 'active'
  ) then
    raise exception 'You do not have access to this workspace.' using errcode = '42501';
  end if;

  update public.workspace_members
  set is_current = false,
      updated_at = now()
  where user_id = current_user_id
    and is_current;

  update public.workspace_members
  set is_current = true,
      updated_at = now()
  where workspace_id = p_workspace_id
    and user_id = current_user_id;

  return p_workspace_id;
end;
$$;

revoke all on function public.switch_workspace(uuid) from public, anon;
grant execute on function public.switch_workspace(uuid) to authenticated;

create or replace function public.create_workspace(p_name text)
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
  normalized_name text := trim(coalesce(p_name, ''));
  base_slug text;
  created_workspace_id uuid;
begin
  if current_user_id is null or current_email = '' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'Workspace name must be between 2 and 120 characters.' using errcode = '22023';
  end if;

  base_slug := btrim(regexp_replace(lower(normalized_name), '[^a-z0-9]+', '-', 'g'), '-');
  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  insert into public.workspaces (name, slug)
  values (normalized_name, left(base_slug, 48) || '-' || substr(gen_random_uuid()::text, 1, 8))
  returning id into created_workspace_id;

  update public.workspace_members
  set is_current = false,
      updated_at = now()
  where user_id = current_user_id
    and is_current;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    email,
    full_name,
    role,
    status,
    is_current
  )
  values (
    created_workspace_id,
    current_user_id,
    current_email,
    current_name,
    'owner',
    'active',
    true
  );

  return created_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

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

create or replace function public.record_workspace_login(
  p_provider text default 'unknown',
  p_user_agent text default null
)
returns bigint
language plpgsql
security definer
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

  current_workspace_id := public.ensure_workspace_membership();

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

create or replace function public.handle_workspace_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_name text;
begin
  if new.email is null then
    return new;
  end if;

  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  perform private.claim_workspace_invites(new.id, new.email, resolved_name);
  return new;
end;
$$;

revoke all on function public.handle_workspace_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_workspace_invite on auth.users;
create trigger on_auth_user_workspace_invite
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_workspace_auth_user();

grant select on public.workspace_invites to authenticated;
